const helpers = {
    range: function (start, end) {
        const result = [];
        for (let i = start; i < end; i++) {
            result.push(i);
        }
        return result;
    },

    times: function (n, block) {
        let accum = "";
        for (let i = 0; i < n; i++) {
            accum += block.fn(i);
        }
        return accum;
    },

    decrementBy: function (a, b) {
        return a - b;
    },

    concat: function () {
        return Array.prototype.slice.call(arguments, 0, -1).join("");
    },

    increment: function (a) {
        return a + 1;
    },

    eq: function (a, b) {
        return a === b;
    },

    and: function () {
        return Array.prototype.every.call(arguments, Boolean);
    },

    lookup: function (obj, field) {
        return obj && obj[field];
    },

    choose_color: function (row, col, hostColor, guestColor) {
        const sum = Number(row) + Number(col);
        return sum % 2 === 0 ? hostColor : guestColor;
    },

    formatDate: function (date) {
        return date.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "numeric",
            second: "numeric",
            hour12: true,
        });
    },
};

module.exports = helpers;
