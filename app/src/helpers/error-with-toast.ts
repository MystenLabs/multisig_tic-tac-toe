import toast from "react-hot-toast";

export function errorWithToast(msg: string, details?: unknown) {
    console.log(msg);
    console.log(details);
    toast.error(msg);
}
