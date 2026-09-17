import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./styles/index.css";
import "./styles/mobile-registration.css";
import "./styles/schedule.css";
import "./scheduling/ScheduleExport.css";
import "./admin/SchedulePortExtras.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
