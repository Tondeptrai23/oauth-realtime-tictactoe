document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("createGameForm");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const formData = {
            boardSize: document.getElementById("boardSize").value,
            turnTimeLimit: document.getElementById("turnTimeLimit").value,
            allowCustomSettings: document.getElementById("allowCustomSettings")
                .checked,
        };

        try {
            const response = await fetch("/lobby/create", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (data.error) {
                if (data.redirectUrl) {
                    window.location.href = data.redirectUrl;
                } else {
                    alert(data.error);
                }
            } else if (data.redirectUrl) {
                window.location.href = data.redirectUrl;
            }
        } catch (error) {
            console.error("Error creating game:", error);
            alert("Failed to create game. Please try again.");
        }
    });
});
