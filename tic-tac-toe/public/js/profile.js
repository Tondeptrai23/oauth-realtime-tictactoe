$(document).ready(function () {
    function showAlert(type, message) {
        const alert =
            $(`<div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>`);

        $("#profileForm").prepend(alert);
        setTimeout(() => alert.alert("close"), 3000);
    }

    $(".piece-option").click(function () {
        $(".piece-option").removeClass("selected");
        $(this).addClass("selected");
    });

    $(".color-box").click(function () {
        $(".color-box").removeClass("selected");
        $(this).addClass("selected");
    });

    $(".avatar-option").on("click", function (e) {
        e.preventDefault();

        $(".avatar-option").removeClass("selected");
        $(this).addClass("selected");
    });

    $(".avatar-option img").on("click", function (e) {
        e.preventDefault();
        e.stopPropagation();

        const avatarOption = $(this).closest(".avatar-option");

        $(".avatar-option").removeClass("selected");
        avatarOption.addClass("selected");
    });

    $("#authAvatar").attr("src", "/profile/avatar");

    $("#profileForm").submit(function (e) {
        e.preventDefault();

        const selectedAvatar = $(".avatar-option.selected").data("avatar");
        const selectedPiece = $(".piece-option.selected").data("piece");
        const selectedColor = $(".color-box.selected").data("color");
        const nickname = $("#nickname").val().trim();

        const formData = {
            nickname: nickname,
            avatar_url: selectedAvatar,
            game_piece: selectedPiece,
            board_color: selectedColor,
        };

        $.ajax({
            url: "/api/profile/update",
            method: "POST",
            data: formData,
            success: function (response) {
                if (response.success) {
                    showAlert("success", "Profile updated successfully!");

                    const displayName = nickname || response.username;
                    $(".navbar-displayname").text(displayName);
                } else {
                    showAlert("danger", "Error updating profile");
                }
            },
            error: function (xhr) {
                showAlert(
                    "danger",
                    "Error: " +
                        (xhr.responseJSON?.error || "Unknown error occurred")
                );
            },
        });
    });
});
