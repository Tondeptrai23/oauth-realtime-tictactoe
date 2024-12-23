$(document).ready(function () {
    const clientsList = $("#clientsList");
    const loadingSpinner = $("#loadingSpinner");
    const template = document.getElementById("clientCardTemplate");

    function getScopeDescription(scope) {
        const descriptions = {
            "profile:basic": "Basic Profile (username, fullname)",
            "profile:full": "Full Profile (includes profile picture)",
        };
        return descriptions[scope] || scope;
    }

    function createClientCard(client) {
        const clone = template.content.cloneNode(true);
        const card = $(clone.querySelector(".client-card"));

        card.attr("data-client-id", client.client_id);

        card.find(".card-title").text(client.name);
        card.find(".client-id").text(client.client_id);
        card.find(".client-secret-value").text(client.client_secret);
        card.find(".website-url").text(client.website_url || "Not specified");
        card.find(".redirect-uri").text(client.redirect_uri);

        const scopesList = card.find(".scopes-list");
        client.allowed_scopes.forEach((scope) => {
            scopesList.append(
                $("<div>", {
                    class: "badge bg-primary me-1",
                    text: getScopeDescription(scope),
                })
            );
        });

        const form = card.find(".update-client-form");
        form.find('input[name="name"]').val(client.name);
        form.find('input[name="websiteUrl"]').val(client.website_url);
        form.find('input[name="redirectUri"]').val(client.redirect_uri);

        client.allowed_scopes.forEach((scope) => {
            form.find(`input[value="${scope}"]`).prop("checked", true);
        });

        return card;
    }

    function loadClients() {
        $.ajax({
            url: "/api/oauth/clients",
            method: "GET",
            headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            success: function (response) {
                loadingSpinner.hide();
                clientsList.empty();

                if (response.clients && response.clients.length > 0) {
                    response.clients.forEach((client) => {
                        const clientCard = createClientCard(client);
                        clientsList.append(clientCard);
                    });
                } else {
                    clientsList.html(`
                        <div class="text-center py-4">
                            <p class="mb-0">You haven't registered any OAuth clients yet.</p>
                        </div>
                    `);
                }
            },
            error: function (xhr) {
                loadingSpinner.hide();
                const error =
                    xhr.responseJSON?.error || "Failed to load clients";
                clientsList.html(`
                    <div class="alert alert-danger" role="alert">
                        ${error}
                    </div>
                `);
            },
        });
    }

    loadClients();

    clientsList.on("click", ".toggle-secret-btn", function () {
        const card = $(this).closest(".client-card");
        const secretMask = card.find(".client-secret-mask");
        const secretValue = card.find(".client-secret-value");
        const button = $(this);

        if (secretValue.hasClass("d-none")) {
            secretMask.addClass("d-none");
            secretValue.removeClass("d-none");
            button.text("Hide Secret");
        } else {
            secretMask.removeClass("d-none");
            secretValue.addClass("d-none");
            button.text("Show Secret");
        }
    });

    clientsList.on("click", ".edit-client-btn", function () {
        const card = $(this).closest(".client-card");
        card.find(".client-details").addClass("d-none");
        card.find(".edit-form").removeClass("d-none");
    });

    clientsList.on("click", ".cancel-edit-btn", function () {
        const card = $(this).closest(".client-card");
        card.find(".client-details").removeClass("d-none");
        card.find(".edit-form").addClass("d-none");
    });

    clientsList.on("submit", ".update-client-form", function (e) {
        e.preventDefault();

        const form = $(this);
        const card = form.closest(".client-card");
        const clientId = card.data("client-id");

        const scopes = [];
        form.find('input[name="scopes[]"]:checked').each(function () {
            scopes.push($(this).val());
        });

        if (!scopes.includes("profile:basic")) {
            scopes.push("profile:basic");
        }

        const formData = {
            name: form.find('input[name="name"]').val(),
            websiteUrl: form.find('input[name="websiteUrl"]').val(),
            redirectUri: form.find('input[name="redirectUri"]').val(),
            scopes: scopes,
        };

        $.ajax({
            url: `/api/oauth/clients/${clientId}`,
            method: "PUT",
            contentType: "application/json",
            data: JSON.stringify(formData),
            headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            success: function (response) {
                loadClients();
                alert("Client updated successfully");
            },
            error: function (xhr) {
                const error =
                    xhr.responseJSON?.error || "Failed to update client";
                alert(error);
            },
        });
    });
});
