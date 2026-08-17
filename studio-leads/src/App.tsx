import React from "react";
import { Routes, Route } from "react-router-dom";
import { LoginPage } from "./pages/Login";
import { DashboardPage } from "./pages/Dashboard";
import { LeadsPage } from "./pages/Leads";
import { AttendancePage } from "./pages/Attendance";
import { KpiPage } from "./pages/Kpi";
import { PersonalSalesFigurePage } from "./pages/PersonalSalesFigure";
import { NoticeBoardPage } from "./pages/NoticeBoard";
import { ShowroomPage } from "./pages/Showroom";
import { FilesArchivePage } from "./pages/FilesArchive";
import { UsersPage } from "./pages/Users";
import { ProtectedRoute } from "./components/ProtectedRoute";

const EVERYONE = ["super_admin", "admin", "designer"] as const;

export const App: React.FC = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route
      path="/"
      element={
        <ProtectedRoute roles={[...EVERYONE]}>
          <DashboardPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/leads"
      element={
        <ProtectedRoute roles={[...EVERYONE]}>
          <LeadsPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/attendance"
      element={
        <ProtectedRoute roles={[...EVERYONE]}>
          <AttendancePage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/kpi"
      element={
        <ProtectedRoute roles={["super_admin", "admin"]}>
          <KpiPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/personal-sales"
      element={
        <ProtectedRoute roles={["designer"]}>
          <PersonalSalesFigurePage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/notice-board"
      element={
        <ProtectedRoute roles={[...EVERYONE]}>
          <NoticeBoardPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/showroom"
      element={
        <ProtectedRoute roles={[...EVERYONE]}>
          <ShowroomPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/files"
      element={
        <ProtectedRoute roles={[...EVERYONE]}>
          <FilesArchivePage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/users"
      element={
        <ProtectedRoute roles={["super_admin", "admin"]}>
          <UsersPage />
        </ProtectedRoute>
      }
    />
  </Routes>
);
