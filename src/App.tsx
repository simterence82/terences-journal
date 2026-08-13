import React from "react";
import { Routes, Route } from "react-router-dom";
import { LoginPage } from "./pages/Login";
import { DashboardPage } from "./pages/Dashboard";
import { LightingPage } from "./pages/Lighting";
import { BlumPage } from "./pages/Blum";
import { TasksPage } from "./pages/Tasks";
import { IssuesPage } from "./pages/Issues";
import { SchedulePage } from "./pages/Schedule";
import { FilesArchivePage } from "./pages/FilesArchive";
import { TrashPage } from "./pages/Trash";
import { UsersPage } from "./pages/Users";
import { ProtectedRoute } from "./components/ProtectedRoute";

export const App: React.FC = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route
      path="/"
      element={
        <ProtectedRoute roles={["admin", "member"]}>
          <DashboardPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/schedule"
      element={
        <ProtectedRoute roles={["admin", "member"]}>
          <SchedulePage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/lighting"
      element={
        <ProtectedRoute roles={["admin", "member"]}>
          <LightingPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/blum"
      element={
        <ProtectedRoute roles={["admin", "member"]}>
          <BlumPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/tasks"
      element={
        <ProtectedRoute roles={["admin", "member"]}>
          <TasksPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/issues"
      element={
        <ProtectedRoute roles={["admin", "member"]}>
          <IssuesPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/files-archive"
      element={
        <ProtectedRoute roles={["admin", "member"]}>
          <FilesArchivePage />
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
    <Route
      path="/trash"
      element={
        <ProtectedRoute roles={["admin"]}>
          <TrashPage />
        </ProtectedRoute>
      }
    />
  </Routes>
);
