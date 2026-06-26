import { useState } from "react";
import LandingPage from "./LandingPage";
import OCRTool from "./OCRTool";

export default function App() {
  const [page, setPage] = useState("home");

  if (page === "tool") {
    return <OCRTool onBack={() => setPage("home")} />;
  }
  return <LandingPage onStart={() => setPage("tool")} />;
}
