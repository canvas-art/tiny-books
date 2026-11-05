import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import "./styles.css";
import { MeProvider } from "./me";
import { AccessGate } from "./components/AccessGate";
import { Shell } from "./components/Shell";
import Home from "./pages/Home";
import Library from "./pages/Library";
import { BookRoute } from "./pages/BookPath";
import Reader from "./pages/Reader";
import Quiz from "./pages/Quiz";
import Groups from "./pages/Groups";
import GroupPage from "./pages/GroupPage";
import LeaguePage from "./pages/League";
import Profile from "./pages/Profile";
import Join from "./pages/Join";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AccessGate>
        <MeProvider>
          <Routes>
            {/* Focus screens: no navigation */}
            <Route path="/read/:id" element={<Reader />} />
            <Route path="/quiz/:chapterId" element={<Quiz />} />
            <Route element={<Shell />}>
              <Route index element={<Home />} />
              <Route path="library" element={<Library />} />
              <Route path="books/:slug" element={<BookRoute />} />
              <Route path="groups" element={<Groups />} />
              <Route path="groups/:id" element={<GroupPage />} />
              <Route path="league" element={<LeaguePage />} />
              <Route path="profile" element={<Profile />} />
              <Route path="join/:code" element={<Join />} />
              <Route path="*" element={<div className="empty"><p>Nothing here.</p></div>} />
            </Route>
          </Routes>
        </MeProvider>
      </AccessGate>
    </BrowserRouter>
  </StrictMode>,
);
