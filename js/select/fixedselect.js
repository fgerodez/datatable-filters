'use strict';

var $ = require('jquery');
var Filters = require('../filters');
var SelectFilter = require('./baseselect');

var FixedSelectFilter = $.extend({}, SelectFilter, {
    init: function () {
        this.$dom = $(this.src);
        this.$dom.on('change', this.notifyChange.bind(this));

        return this;
    },

    populate: function () {
        this._saveSelection();

        return this;
    },

    update: function () {
        return this;
    },

    getInitialQuery: function() {
        return this.getQuery();
    }
});

Filters.prototype.builders.fixedselect = function(settings) {
    return $.extend({}, FixedSelectFilter, settings);
};

module.exports = FixedSelectFilter;