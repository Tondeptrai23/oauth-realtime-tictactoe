$(document).ready(function () {
    loadProfile();

    $("#profileForm").on("submit", function (e) {
        e.preventDefault();
        updateProfile();
    });

    $("#uploadAvatar").on("click", function () {
        uploadAvatar();
    });

    $("#avatarInput").on("change", function (e) {
        if (this.files && this.files[0]) {
            const reader = new FileReader();
            reader.onload = function (e) {
                $("#avatarPreview").attr("src", e.target.result);
            };
            reader.readAsDataURL(this.files[0]);
        }
    });
});

function loadProfile() {
    const token = localStorage.getItem("token");
    const userId = token ? JSON.parse(atob(token.split(".")[1])).id : null;

    if (!userId) {
        window.location.href = "/login";
        return;
    }

    $.ajax({
        url: `/api/profile/avatar`,
        method: "GET",
        headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        xhrFields: {
            responseType: "arraybuffer",
        },
        processData: false,
        success: function (response) {
            const base64String = btoa(
                new Uint8Array(response).reduce(
                    (data, byte) => data + String.fromCharCode(byte),
                    ""
                )
            );

            $("#avatarPreview").attr(
                "src",
                `data:image/png;base64,${base64String}`
            );
        },
        error: function (xhr) {
            const error = xhr.responseJSON?.error || "Failed to load avatar";
            alert(error);
        },
    });

    $.ajax({
        url: "/api/profile",
        method: "GET",
        headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        success: function (response) {
            $("#username").val(response.username);
            $("#fullname").val(response.fullname);
            $("#nickname").val(response.nickname);
        },
        error: function (xhr) {
            const error = xhr.responseJSON?.error || "Failed to load profile";
            alert(error);
        },
    });
}

function updateProfile() {
    const data = {
        fullname: $("#fullname").val(),
        nickname: $("#nickname").val(),
    };

    $.ajax({
        url: "/api/profile",
        method: "PUT",
        headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        contentType: "application/json",
        data: JSON.stringify(data),
        success: function () {
            alert("Profile updated successfully");
        },
        error: function (xhr) {
            const error = xhr.responseJSON?.error || "Failed to update profile";
            alert(error);
        },
    });
}

function uploadAvatar() {
    const fileInput = $("#avatarInput")[0];
    if (!fileInput.files || !fileInput.files[0]) {
        alert("Please select a file first");
        return;
    }

    const formData = new FormData();
    formData.append("avatar", fileInput.files[0]);

    $.ajax({
        url: "/api/profile/avatar",
        method: "PUT",
        headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        data: formData,
        processData: false,
        contentType: false,
        success: function () {
            alert("Avatar updated successfully");
        },
        error: function (xhr) {
            const error = xhr.responseJSON?.error || "Failed to update avatar";
            alert(error);
        },
    });
}
