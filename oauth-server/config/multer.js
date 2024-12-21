const multer = require("multer");

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif"];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(
            new Error(
                "Invalid file type. Only JPEG, PNG and GIF files are allowed."
            ),
            false
        );
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
});

const handleMulterError = (error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                error: "File is too large. Maximum size is 5MB.",
            });
        }
        return res.status(400).json({
            error: `Upload error: ${error.message}`,
        });
    } else if (error) {
        return res.status(400).json({
            error: error.message,
        });
    }
    next();
};

module.exports = {
    upload,
    handleMulterError,
};
