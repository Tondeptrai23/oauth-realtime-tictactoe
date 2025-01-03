$(document).ready(function () {
    const token = localStorage.getItem("token");
    if (token) {
        const payload = JSON.parse(atob(token.split(".")[1]));
        $("#username").text(payload.username);
    } else {
        window.location.href = "/login";
    }

    $("#closeModal").on("click", function () {
        $("#registerClientForm")[0].reset();

        window.location.href = "/my-clients";
    });

    $("#scope-profile-basic").on("change", function () {
        if (!$(this).is(":checked")) {
            $(this).prop("checked", true);
            alert("Basic profile scope is required");
        }
    });

    $("#registerClientForm").on("submit", function (e) {
        e.preventDefault();

        const selectedScopes = [];
        $('input[name="scopes[]"]:checked').each(function () {
            selectedScopes.push($(this).val());
        });

        const formData = {
            name: $("#name").val(),
            description: $("#description").val(),
            websiteUrl: $("#websiteUrl").val(),
            redirectUri: $("#redirectUri").val(),
            scopes: selectedScopes,
        };

        $.ajax({
            url: "/api/oauth/clients",
            method: "POST",
            headers: {
                Authorization: "Bearer " + localStorage.getItem("token"),
                "Content-Type": "application/json",
            },
            data: JSON.stringify(formData),
            success: function (response) {
                $("#clientId").val(response.client.client_id);
                $("#clientSecret").val(response.client.clientSecret);

                new bootstrap.Modal(
                    document.getElementById("credentialsModal")
                ).show();

                $("#registerClientForm")[0].reset();
            },
            error: function (xhr) {
                const error =
                    xhr.responseJSON?.error || "Failed to register application";
                alert(error);
            },
        });
    });
});
