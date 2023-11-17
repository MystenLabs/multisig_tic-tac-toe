import toast from "react-hot-toast";

export function consoleAndToast(forConsole: unknown, forToast: string) {
    console.log(forToast);
    console.log(forConsole);
    toast.error(forToast);
}
