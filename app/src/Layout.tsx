import { Outlet } from "react-router-dom";
import { NavBar } from "./components/NavBar";

export const Layout = () => {
  return (
    <div className="space-y-2">
      <NavBar />
      <Outlet />
    </div>
  );
};
