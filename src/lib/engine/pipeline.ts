/**
 * AgenticVC Pipeline Engine — DAG Executor
 *
 * This is the heart of the engine. It takes a set of PipelineNodes forming a
 * directed acyclic graph (DAG), resolves dependencies, and executes nodes in
 * the correct order — running independent nodes in parallel.
 *
 * Architecture:
 *   ┌─────────────┐
 *   │  research    │──┐
 *   └─────────────┘  │  ┌──────────────┐    ┌───────────────┐    ┌───────────┐
 *                     ├──│   recruit     │───│   critique     │───│  cross-   │
 *   ┌─────────────┐  │  └──────────────┘    │  (3 parallel)  │   │  examine  │
 *   │    pitch     │──┘                      └───────────────┘    └─────┬─────┘
 *   └─────────────┘                                                     │
 *                                                                       ▼
 *                                              ┌──────────────────────────┐
 *                                              │   [USER DEFENSE INPUT]   │
 *                                              └────────────┬─────────────┘
 *                                                           ▼
 *                                              ┌──────────────────────────┐
 *                                              │       synthesize         │
 *                                              └──────────────────────────┘
 *
 * Key features:
 *   - Topological ordering for dependency resolution
 *   - Parallel execution of independent nodes
 *   - "waiting" nodes that pause until external input arrives
 *   - Per-node retry with exponential backoff
 *   - Graceful degradation: non-critical node failures don't kill the pipeline
 *   - Real-time SSE events for every state transition
 */

import type {
  PipelineNode,
  PipelineEvent,
  EventEmitter,
  ExecutionContext,
  Session,
  SessionData,
  NodeState,
  NodeStatus,
} from './types';
import { withRetry } from './retry';
import { PipelineError, RetryExhaustedError } from './errors';
import { log } from './logger';

// ---------------------------------------------------------------------------
// Pipeline Definition
// ---------------------------------------------------------------------------

/**
 * A pipeline definition — an ordered list of nodes forming the DAG.
 * Created by PipelineBuilder and executed by PipelineExecutor.
 */
export interface PipelineDefinition {
  nodes: PipelineNode[];
}

/**
 * Builder for constructing pipelines declaratively.
 *
 * @example
 *   const pipeline = new PipelineBuilder()
 *     .addNode(researchNode)
 *     .addNode(recruitNode)
 *     .addNode(critiqueNode)
 *     .addNode(crossExamineNode)
 *     .addNode(synthesizeNode)
 *     .build();
 */
export class PipelineBuilder {
  private nodes: PipelineNode[] = [];

  /**
   * Add a node to the pipeline.
   * Order doesn't matter — the executor resolves execution order from dependencies.
   */
  addNode(node: PipelineNode): PipelineBuilder {
    this.nodes.push(node);
    return this;
  }

  /**
   * Validate and build the pipeline definition.
   * @throws PipelineError if the graph has cycles or missing dependencies
   */
  build(): PipelineDefinition {
    this.validateDAG();
    return { nodes: [...this.nodes] };
  }

  /**
   * Validate that the node graph is a valid DAG:
   *   1. All dependency references point to existing nodes
   *   2. No circular dependencies
   */
  private validateDAG(): void {
    const nodeIds = new Set(this.nodes.map((n) => n.id));

    // Check all dependencies reference existing nodes
    for (const node of this.nodes) {
      for (const dep of node.dependencies) {
        if (!nodeIds.has(dep)) {
          throw new PipelineError(
            `Node "${node.id}" depends on "${dep}", which doesn't exist in the pipeline.`,
            { retryable: false, statusCode: 500 },
          );
        }
      }
    }

    // Detect cycles using DFS
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const adjList = new Map<string, string[]>();

    for (const node of this.nodes) {
      adjList.set(node.id, node.dependencies);
    }

    const hasCycle = (nodeId: string): boolean => {
      visited.add(nodeId);
      inStack.add(nodeId);

      for (const dep of adjList.get(nodeId) || []) {
        if (!visited.has(dep)) {
          if (hasCycle(dep)) return true;
        } else if (inStack.has(dep)) {
          return true;
        }
      }

      inStack.delete(nodeId);
      return false;
    };

    for (const node of this.nodes) {
      if (!visited.has(node.id)) {
        if (hasCycle(node.id)) {
          throw new PipelineError(
            `Circular dependency detected involving node "${node.id}".`,
            { retryable: false, statusCode: 500 },
          );
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Pipeline Executor
// ---------------------------------------------------------------------------

/**
 * Executes a pipeline definition against a session.
 *
 * The executor maintains a mutable session object and emits events via SSE.
 * It processes nodes in topological order, running independent nodes in parallel.
 *
 * Lifecycle:
 *   1. Initialize all node states to 'pending'
 *   2. Find nodes whose dependencies are all 'done' → run them in parallel
 *   3. When a node completes, merge its output into session data
 *   4. If a node is 'waiting' (needs user input), pause the pipeline
 *   5. When input arrives, resume from step 2
 *   6. Continue until all nodes are done (or a critical node fails)
 */
export class PipelineExecutor {
  private pipeline: PipelineDefinition;
  private session: Session;
  private emit: EventEmitter;
  private nodeMap: Map<string, PipelineNode>;
  /** Resolvers for 'waiting' nodes — called when external input arrives */
  private waitResolvers: Map<string, (data: Partial<SessionData>) => void> = new Map();

  constructor(pipeline: PipelineDefinition, session: Session, emit: EventEmitter) {
    this.pipeline = pipeline;
    this.session = session;
    this.emit = emit;
    this.nodeMap = new Map(pipeline.nodes.map((n) => [n.id, n]));

    // Initialize node states
    for (const node of pipeline.nodes) {
      if (!this.session.nodeStates[node.id]) {
        this.session.nodeStates[node.id] = {
          nodeId: node.id,
          status: 'pending',
          attempts: 0,
        };
      }
    }
  }

  /**
   * Run the pipeline to completion (or until it hits a 'waiting' node).
   *
   * This method is re-entrant: after providing input to a waiting node,
   * call run() again to resume execution.
   */
  async run(): Promise<Session> {
    log('info', `Pipeline starting for session ${this.session.id}`);
    this.updateSessionStatus('running');

    try {
      await this.executeReadyNodes();

      // Check final state
      const allDone = this.pipeline.nodes.every(
        (n) => {
          const state = this.session.nodeStates[n.id];
          return state.status === 'done' || state.status === 'skipped';
        }
      );

      const hasWaiting = this.pipeline.nodes.some(
        (n) => this.session.nodeStates[n.id].status === 'waiting'
      );

      if (allDone) {
        this.updateSessionStatus('completed');
        this.emit({
          type: 'pipeline:done',
          sessionId: this.session.id,
          timestamp: Date.now(),
        });
        log('info', `Pipeline completed for session ${this.session.id}`);
      } else if (hasWaiting) {
        this.updateSessionStatus('waiting');
        log('info', `Pipeline waiting for user input on session ${this.session.id}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log('error', `Pipeline failed for session ${this.session.id}: ${message}`);
      this.updateSessionStatus('failed');
      this.emit({
        type: 'pipeline:error',
        sessionId: this.session.id,
        error: message,
        timestamp: Date.now(),
      });
    }

    return this.session;
  }

  /**
   * Provide external input to a waiting node and resume the pipeline.
   *
   * @param nodeId - The ID of the waiting node
   * @param data - The data to merge into the session (e.g., user defense text)
   */
  async provideInput(nodeId: string, data: Partial<SessionData>): Promise<Session> {
    const nodeState = this.session.nodeStates[nodeId];
    if (!nodeState || nodeState.status !== 'waiting') {
      throw new PipelineError(
        `Node "${nodeId}" is not waiting for input (current status: ${nodeState?.status}).`,
        { retryable: false, statusCode: 400 },
      );
    }

    // Merge input data into session
    Object.assign(this.session.data, data);

    // Mark node as done
    this.updateNodeStatus(nodeId, 'done');

    log('info', `Input provided for node "${nodeId}". Resuming pipeline.`);

    // Resume execution
    return this.run();
  }

  /**
   * Get the current session state.
   */
  getSession(): Session {
    return this.session;
  }

  // -------------------------------------------------------------------------
  // Internal Execution Logic
  // -------------------------------------------------------------------------

  /**
   * Find and execute all nodes whose dependencies are satisfied.
   * Runs independent nodes in parallel. Recurses until no more nodes are ready.
   */
  private async executeReadyNodes(): Promise<void> {
    const readyNodes = this.getReadyNodes();

    if (readyNodes.length === 0) return;

    log('debug', `Ready nodes: ${readyNodes.map((n) => n.id).join(', ')}`);

    // Execute all ready nodes in parallel
    await Promise.all(
      readyNodes.map((node) => this.executeNode(node)),
    );

    // After this batch completes, check if more nodes are now ready
    // (unless pipeline is waiting or failed)
    if (this.session.status === 'running') {
      await this.executeReadyNodes();
    }
  }

  /**
   * Get all nodes that are ready to execute:
   *   - Status is 'pending'
   *   - All dependencies are 'done' or 'skipped'
   */
  private getReadyNodes(): PipelineNode[] {
    return this.pipeline.nodes.filter((node) => {
      const state = this.session.nodeStates[node.id];
      if (state.status !== 'pending') return false;

      return node.dependencies.every((depId) => {
        const depState = this.session.nodeStates[depId];
        return depState.status === 'done' || depState.status === 'skipped';
      });
    });
  }

  /**
   * Execute a single node with retry logic.
   */
  private async executeNode(node: PipelineNode): Promise<void> {
    const startTime = Date.now();
    this.updateNodeStatus(node.id, 'running');
    this.session.nodeStates[node.id].startedAt = startTime;

    const ctx: ExecutionContext = {
      sessionId: this.session.id,
      config: this.session.config,
      data: { ...this.session.data },
    };

    // Create a scoped event emitter that fills in the sessionId
    const scopedEmit: EventEmitter = (event) => {
      this.emit({ ...event, sessionId: this.session.id });
    };

    try {
      const result = await withRetry(
        node.id,
        () => node.execute(ctx, scopedEmit),
        node.retryConfig,
        scopedEmit,
      );

      // Merge result into session data
      if (result) {
        Object.assign(this.session.data, result);
      }

      this.session.nodeStates[node.id].completedAt = Date.now();
      this.updateNodeStatus(node.id, 'done');

      // Emit the final result
      scopedEmit({
        type: 'node:result',
        sessionId: this.session.id,
        nodeId: node.id,
        data: result,
        timestamp: Date.now(),
      });

      const duration = Date.now() - startTime;
      log('info', `Node "${node.id}" completed in ${duration}ms`);
    } catch (error) {
      this.session.nodeStates[node.id].completedAt = Date.now();
      const message = error instanceof Error ? error.message : String(error);

      // Check if this is a "waiting" signal (special error for user input nodes)
      if (error instanceof WaitForInputSignal) {
        this.updateNodeStatus(node.id, 'waiting');
        return;
      }

      if (node.retryConfig.critical) {
        // Critical node failure → pipeline fails
        this.updateNodeStatus(node.id, 'error', message);
        log('error', `Critical node "${node.id}" failed. Pipeline aborting.`);
        throw error;
      } else {
        // Non-critical node failure → skip and continue
        this.updateNodeStatus(node.id, 'skipped', message);
        log('warn', `Non-critical node "${node.id}" failed. Skipping. Error: ${message}`);
      }
    }
  }

  /**
   * Update a node's status and emit an SSE event.
   */
  private updateNodeStatus(nodeId: string, status: NodeStatus, error?: string): void {
    const nodeState = this.session.nodeStates[nodeId];
    nodeState.status = status;
    if (status === 'running') {
      nodeState.attempts += 1;
    }
    if (error) {
      nodeState.error = error;
    }

    this.emit({
      type: 'node:status',
      sessionId: this.session.id,
      nodeId,
      status,
      attempt: nodeState.attempts,
      error,
      timestamp: Date.now(),
    });

    this.session.updatedAt = new Date().toISOString();
  }

  /**
   * Update the session's top-level status and emit an SSE event.
   */
  private updateSessionStatus(status: Session['status']): void {
    this.session.status = status;
    this.session.updatedAt = new Date().toISOString();

    this.emit({
      type: 'session:status',
      sessionId: this.session.id,
      status,
      timestamp: Date.now(),
    });
  }
}

// ---------------------------------------------------------------------------
// Wait Signal
// ---------------------------------------------------------------------------

/**
 * Special "error" thrown by nodes that need to pause and wait for external input.
 * The pipeline executor catches this and sets the node to 'waiting' status.
 *
 * This is NOT a real error — it's a control flow signal. Using an error-like
 * object simplifies the executor logic since it already has try/catch.
 *
 * @example
 *   // In a node's execute function:
 *   throw new WaitForInputSignal('user-defense', 'Waiting for user defense input.');
 */
export class WaitForInputSignal {
  readonly nodeId: string;
  readonly message: string;

  constructor(nodeId: string, message: string) {
    this.nodeId = nodeId;
    this.message = message;
  }
}
