import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./styles.css";
import { StoreProvider } from "./lib/store";
import Shell, { Guard } from "./components/Shell";
import Home from "./pages/Home";
import Pipeline from "./pages/Pipeline";
import LeadDetail from "./pages/LeadDetail";
import Direccion from "./pages/Direccion";
import PublicQuote from "./pages/PublicQuote";
import PublicChat from "./pages/PublicChat";
import { Catalogo, DemoCenter, Integraciones } from "./pages/Misc";
import Cotizaciones from "./pages/Cotizaciones";
import ModelDetail from "./pages/ModelDetail";
const AutoshowApp = lazy(() => import("./autoshow/AutoshowApp"));
const PublicASQuote = lazy(() => import("./autoshow/PublicASQuote"));
const L = (el) => <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>Cargando…</div>}>{el}</Suspense>;

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Routes>
      <Route path="/autoshow/c/:token" element={L(<PublicASQuote />)} />
      <Route path="/autoshow/*" element={L(<AutoshowApp />)} />
      <Route path="/c/:token" element={<PublicQuote />} />
      <Route path="/chat" element={<PublicChat />} />
      <Route path="/chat/:token" element={<PublicChat />} />
      <Route element={<StoreProvider><Shell /></StoreProvider>}>
        <Route index element={<Home />} />
        <Route path="pipeline" element={<Guard sec="pipeline"><Pipeline /></Guard>} />
        <Route path="lead/:id" element={<Guard sec="pipeline"><LeadDetail /></Guard>} />
        <Route path="direccion" element={<Guard sec="direccion"><Direccion /></Guard>} />
        <Route path="catalogo" element={<Guard sec="catalogo"><Catalogo /></Guard>} />
        <Route path="catalogo/:id" element={<Guard sec="catalogo"><ModelDetail /></Guard>} />
        <Route path="cotizaciones" element={<Guard sec="cotizaciones"><Cotizaciones /></Guard>} />
        <Route path="demo" element={<Guard sec="demo"><DemoCenter /></Guard>} />
        <Route path="integraciones" element={<Guard sec="integraciones"><Integraciones /></Guard>} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  </BrowserRouter>
);
