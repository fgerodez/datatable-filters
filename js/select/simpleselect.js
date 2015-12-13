'use strict';

var $ = require('jquery');
var Filters = require('../filters');
var SelectFilter = require('./baseselect');

var SimpleSelectFilter = $.extend({}, SelectFilter, {
    init: function () {
        this.$dom = $('<select class="filtre"/>');
        this.$dom.on('change', this._onChange.bind(this));

        return this;
    },

    populate: function (data) {
        this._addOptions(data, this._addOption);
        this._onChange();

        return this;
    },

    update: function (data) {
        this._addOptions(data, this._addOption);

        return this;
    },

    getInitialQuery: function() {
        return '';
    }
});

Filters.prototype.builders.select = function(settings) {
    return $.extend({}, SimpleSelectFilter, settings);
};

module.exports = SimpleSelectFilter;