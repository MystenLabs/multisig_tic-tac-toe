import { Outlet, createBrowserRouter } from "react-router-dom";
import { NotFoundPage } from "../pages/NotFoundPage";
import { AuthenticationRouter } from "../AuthenticationRouter";
import CreateOrJoinGame from "../components/CreateOrJoinGame";
import Game from "../components/Game";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Outlet />,
    children: [
      {
        path: "",
        element: <AuthenticationRouter />,
        children: [
          {
            path: "",
            element: <CreateOrJoinGame />,
          },
          {
            path: "game/:oppoPubKey/:gameId",
            element: <Game />,
          },
        ],
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);
