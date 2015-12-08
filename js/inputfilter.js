'use strict';

var $ = require('jquery');
var BaseFilter = require('./basefilter');

/**
 * InputFilter
 *
 * Simple input text filter
 *
 */
var InputFilter = function (config) {
    $.extend(this, config);

    this.$dom = $('<input type="text" class="filtre"></input>').on('input', $.proxy(function () {
        this.notifyChange();
    }, this));
};

$.extend(InputFilter.prototype, BaseFilter, {

    render: function ($container, header) {
        this.$dom.attr('placeholder', header);
        this.showFilter(this.$dom, $container, header);
    },

    getQuery: function () {
        return this.$dom.val();
    }
});

module.exports = InputFilter;