import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "./components/ui/sonner";
import { queryClient } from "./lib/queryClient";

import Login from "./routes/login";
import RequireAuth from "./routes/RequireAuth";
import PagesIndex from "./routes/pages/index";
import PagesDetail from "./routes/pages/detail";
import PagesEditor from "./routes/pages/editor";
import PagePreview from "./routes/public/PagePreview";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/pages" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/p/:slug" element={<PagePreview />} />

          <Route element={<RequireAuth />}>
            <Route path="/pages" element={<PagesIndex />} />
            <Route path="/pages/:id" element={<PagesDetail />} />
            <Route path="/pages/:id/editor" element={<PagesEditor />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  );
}
