import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./styles.css";
import { StoreProvider } from "./lib/store";
import Shell from "./components/Shell";
import Home from "./pages/Home";
import Pipeline from "./pages/Pipeline";
import LeadDetail from "./pages/LeadDetail";
import Direccion from "./pages/Direccion";
import PublicQuote from "./pages/PublicQuote";
import PublicChat from "./pages/PublicChat";
import { Catalogo, Cotizaciones, DemoCenter, Integraciones } from "./pages/Misc";

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      <Route path="/c/:token" element={<PublicQuote />} />
      <Route path="/chat" element={<PublicChat />} />
      <Route path="/chat/:token" element={<PublicChat />} />
      <Route element={<StoreProvider><Shell /></StoreProvider>}>
        <Route index element={<Home />} />
        <Route path="pipeline" element={<Pipeline />} />
        <Route path="lead/:id" element={<LeadDetail />} />
        <Route path="direccion" element={<Direccion />} />
        <Route path="catalogo" element={<Catalogo />} />
        <Route path="cotizaciones" element={<Cotizaciones />} />
        <Route path="demo" element={<DemoCenter />} />
        <Route path="integraciones" element={<Integraciones />} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  </BrowserRouter>
);
