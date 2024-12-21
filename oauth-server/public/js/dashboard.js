$(document).ready(function () {
    // Get user info from token
    const token = localStorage.getItem("token");
    if (token) {
        const payload = JSON.parse(atob(token.split(".")[1]));
        $("#userEmail").text(payload.email);
    } else {
        window.location.href = "/login";
    }

    $("#logoutBtn").on("click", function () {
        localStorage.removeItem("token");
        window.location.href = "/login";
    });
});
