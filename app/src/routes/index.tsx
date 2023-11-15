import CreateOrJoinGame from "../pages/CreateOrJoinGame";
import Game from "../pages/Game";
import { AuthenticationRouter } from "../AuthenticationRouter";
import { Layout } from "../Layout";
import { NotFoundPage } from "../pages/NotFoundPage";
import { createBrowserRouter } from "react-router-dom";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
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
