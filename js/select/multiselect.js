'use strict';

var $ = require('jquery');
var Filters = require('../filters');
var SelectFilter = require('./baseselect');

var MultiSelectFilter = $.extend({}, SelectFilter, {
    init: function () {
        this.$dom = $('<select class="filtre"/>');

        this.$dom.attr('multiple', 'multiple')
            .on('change', this._onChange.bind(this));

        return this;
    },

    populate: function (data) {
        this._addOptions(data, this._addSelectedOption);
        this._saveSelection();

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

Filters.prototype.builders.multiselect = function(settings) {
    return $.extend({}, MultiSelectFilter, settings);
};

module.exports = MultiSelectFilter;