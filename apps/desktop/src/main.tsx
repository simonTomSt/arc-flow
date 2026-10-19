import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { StoreProvider, useStore } from "./state/store";
import { LangContext } from "./i18n";
import "./styles/tokens.css";
import "./styles/app.css";

function Localized() {
  const { state } = useStore();
  return (
    <LangContext.Provider value={state.lang}>
      <App />
    </LangContext.Provider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StoreProvider>
      <Localized />
    </StoreProvider>
  </StrictMode>,
);
