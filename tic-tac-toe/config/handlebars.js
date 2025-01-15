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
            block.data = block.data || {};
            block.data.index = i;
            accum += block.fn({ index: i });
        }
        return accum;
    },

    subtract: function (a, b) {
        return a - b;
    },

    concat: function (...args) {
        args.pop();
        return args.join("");
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

    add: function (a, b) {
        return a + b;
    },
};

module.exports = helpers;
