import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/sonner";
import { queryClient } from "./lib/queryClient";

import Login from "./routes/login";
import RequireAuth from "./routes/RequireAuth";
import Layout from "./routes/Layout";
import PagesIndex from "./routes/pages/index";
import PagesDetail from "./routes/pages/detail";
import PagesEditor from "./routes/pages/editor";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/pages" replace />} />
          <Route path="/login" element={<Login />} />
          {/* /p/:slug é servido pelo api/render-page.ts (ver vercel.json) — nunca chega ao React */}

          <Route element={<RequireAuth />}>
            {/* Editor fica fora do Layout — precisa da tela inteira */}
            <Route path="/pages/:id/editor" element={<PagesEditor />} />

            <Route element={<Layout />}>
              <Route path="/pages" element={<PagesIndex />} />
              <Route path="/pages/:id" element={<PagesDetail />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  );
}
