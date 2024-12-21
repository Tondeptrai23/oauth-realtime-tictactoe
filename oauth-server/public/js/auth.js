$(document).ready(function () {
    $("#registerForm").on("submit", function (e) {
        e.preventDefault();

        const username = $("#username").val();
        const password = $("#password").val();

        $.ajax({
            url: "/api/auth/register",
            method: "POST",
            contentType: "application/json",
            data: JSON.stringify({ username, password }),
            success: function (response) {
                localStorage.setItem("token", response.token);
                window.location.href = "/dashboard";
            },
            error: function (xhr) {
                const error = xhr.responseJSON.error || "Registration failed";
                alert(error);
            },
        });
    });

    $("#loginForm").on("submit", function (e) {
        e.preventDefault();

        const username = $("#username").val();
        const password = $("#password").val();

        $.ajax({
            url: "/api/auth/login",
            method: "POST",
            contentType: "application/json",
            data: JSON.stringify({ username, password }),
            success: function (response) {
                localStorage.setItem("token", response.token);
                window.location.href = "/dashboard";
            },
            error: function (xhr) {
                const error = xhr.responseJSON.error || "Login failed";
                alert(error);
            },
        });
    });
});
