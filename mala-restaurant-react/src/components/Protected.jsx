// src/components/Protected.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/auth.js";

export default function Protected({ roles = [], children }) {
  const { user } = useAuthStore();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (roles.length && !roles.includes(user.role)) {
    return <div style={{ padding: 24 }}>คุณไม่มีสิทธิ์เข้าถึงหน้านี้</div>;
  }
  return children;
}
 