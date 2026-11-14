export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:4911").replace(/\/+$/, "");
export const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || API_URL).replace(/\/+$/, "");

export const getImageUrl = (image) => {
    if(!image){
        return "";
    }

    if(/^https?:\/\//i.test(image)){
        return image;
    }

    const cleanPath = String(image).replace(/^\/+/, "");

    if(cleanPath.startsWith("images/")){
        return `${API_URL}/${cleanPath}`;
    }

    return `${API_URL}/images/${cleanPath}`;
};