import React from "react";
import { Routes, Route } from "react-router-dom";
import { LoginPage } from "./pages/Login";
import { DashboardPage } from "./pages/Dashboard";
import { LeadsPage } from "./pages/Leads";
import { AttendancePage } from "./pages/Attendance";
import { KpiPage } from "./pages/Kpi";
import { NoticeBoardPage } from "./pages/NoticeBoard";
import { ShowroomPage } from "./pages/Showroom";
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
        <ProtectedRoute roles={[...EVERYONE]}>
          <KpiPage />
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
        <ProtectedRoute roles={["super_admin", "admin"]}>
          <ShowroomPage />
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
