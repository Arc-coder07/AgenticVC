# AgenticVC

<div align="center">
  <img src="./public/screenshot.png" alt="AgenticVC Screenshot" width="800"/>
</div>

**Stress-test your logic.**

AgenticVC is an autonomous multi-agent debate system designed to tear apart your business pitches and system architectures to find fatal flaws before you launch. 

Whether you want to face a ruthless **Investment Committee** or a critical **Board of Directors**, AgenticVC will recruit specialized AI personas to scrutinize your ideas, debate among themselves, and deliver an actionable pre-mortem report.

## 🚀 Features

- **Adversarial AI Nodes**: Submit your pitch, and the system dynamically recruits 3 expert personas (e.g., Cynical CFO, Security Auditor, Go-to-Market Skeptic) tailored to your specific industry and context.
- **Cross-Examination Loop**: The personas don't just critique your idea—they argue with each other, exposing hidden logical gaps.
- **Dual Simulation Modes**: Toggle between "Investment Committee (VC)" mode and "Board of Directors" mode to change the context and severity of the stress test.
- **Interactive Defense**: You get one chance to take the stand and defend your logic before the final verdict is delivered.
- **Pre-Mortem PDF Export**: The Lead Partner (or Chairman) synthesizes the debate into a downloadable, actionable PDF report.

## 🛠 Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Styling**: Tailwind CSS & [shadcn/ui](https://ui.shadcn.com/)
- **AI Integration**: [Vercel AI SDK](https://sdk.vercel.ai/docs) (Supports Gemini, OpenRouter, Groq)
- **Search**: [Tavily API](https://tavily.com/) (for live market context)
- **PDF Generation**: html2canvas & jsPDF

## 💻 Getting Started

### 1. Install Dependencies
```bash
npm install
# or
yarn install
# or
pnpm install
```

### 2. Run the Development Server
```bash
npm run dev
```

### 3. Usage
Open [http://localhost:3000](http://localhost:3000) with your browser.
Expand the **API Configuration** accordion to select your AI Provider, enter your API Key, and toggle between VC/Board modes.

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the issues page.
