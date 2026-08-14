import React from "react";
import { Routes, Route } from "react-router-dom";
import { LoginPage } from "./pages/Login";
import { DashboardPage } from "./pages/Dashboard";
import { LeadsPage } from "./pages/Leads";
import { AttendancePage } from "./pages/Attendance";
import { KpiPage } from "./pages/Kpi";
import { UsersPage } from "./pages/Users";
import { ProtectedRoute } from "./components/ProtectedRoute";

export const App: React.FC = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route
      path="/"
      element={
        <ProtectedRoute roles={["admin", "designer"]}>
          <DashboardPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/leads"
      element={
        <ProtectedRoute roles={["admin", "designer"]}>
          <LeadsPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/attendance"
      element={
        <ProtectedRoute roles={["admin", "designer"]}>
          <AttendancePage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/kpi"
      element={
        <ProtectedRoute roles={["admin", "designer"]}>
          <KpiPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/users"
      element={
        <ProtectedRoute roles={["admin"]}>
          <UsersPage />
        </ProtectedRoute>
      }
    />
  </Routes>
);
