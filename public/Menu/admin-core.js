// ==============================
// ==== ADMIN CORE (Shared) =====
// ==============================

const API_URL = "http://localhost:3000/api";

// ==== UTILS ====

async function fetchData(url, options = {}) {
    try {
        const res = await fetch(url, options);
        if (!res.ok) {
            let errorMsg = `Error en la petición: ${res.status}`;
            try {
                const errorBody = await res.json();
                if (errorBody.message) errorMsg += ` - ${errorBody.message}`;
            } catch (e) {
                const errorText = await res.text();
                if (errorText) errorMsg += ` - ${errorText}`;
            }
            throw new Error(errorMsg);
        }

        if (res.status === 204) return null;

        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            return await res.json();
        }

        const text = await res.text();
        return text ? text : null;
    } catch (err) {
        console.error("Error fetchData:", err);
        throw err;
    }
}

function formatDateTime12h(dateString) {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleString('es-VE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}
