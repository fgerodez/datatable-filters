'use strict';

var $ = require('jquery');
var BaseBackend = require('./basebackend');

var SelectBackend = {
    selected: [],

    noSelectionQuery: function () {
        return '$^';
    },

    isRegexMatch: function () {
        return true;
    },

    hasValue: function () {
        return this._getSelection().length > 0;
    },

    selectedQuery: function () {
        return this._getSelection().map(function (option) {
            if (option.value == this.allText) {
                return '';
            } else {
                return '^' + $.fn.dataTable.util.escapeRegex(option.value) + '$';
            }
        }, this).join('|');
    },

    /**
     * Filters the options before adding them to the select. Can be overridden
     * for specific filtering
     *
     * @param value {String} Option value
     */
    filterOptions: function (value) {
        return value.trim() != '';
    },

    /**
     * Sort the options before adding them to the select. Can be overridden for
     * specific sorts
     */
    sortOptions: function (a, b) {
        if (a > b) {
            return 1;
        }

        if (a < b) {
            return -1;
        }

        return 0;
    },

    _getSelection: function () {
        return this.$dom.find('option:selected').toArray();
    },

    _addOptions: function (data, fnCreate) {
        this.$dom.empty();

        if (this.allText)
            fnCreate.call(this, this.allText);

        data.toArray().filter(this.filterOptions).sort(this.sortOptions).forEach(fnCreate, this);
    },

    _addSelectedOption: function (value) {
        this.$dom.append($('<option/>')
            .val(value)
            .text(value)
            .attr('selected', 'selected')
        );
    },

    _addOption: function (value) {
        var $option = $('<option/>')
            .val(value)
            .text(value);

        if ($.inArray(value, this.selected) > -1)
            $option.attr('selected', 'selected');

        this.$dom.append($option);
    },

    _onChange: function() {
        this.selected = this._getSelection();
        this.notifyChange();
    }
};

var MultiSelectBackend = $.extend({}, SelectBackend, BaseBackend, {
    init: function () {
        this.$dom = $('<select class="filtre"/>');

        this.$dom.attr('multiple', 'multiple')
            .on('change', this._onChange.bind(this));

        return this;
    },

    populate: function (data) {
        this._addOptions(data, this._addSelectedOption);

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

var SimpleSelectBackend = $.extend({}, SelectBackend, BaseBackend, {
    init: function () {
        this.$dom = $('<select class="filtre"/>');
        this.$dom.on('change', this._onChange.bind(this));

        return this;
    },

    populate: function (data) {
        this._addOptions(data, this._addOption);

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

var FixedSelectBackend = $.extend({}, SelectBackend, BaseBackend, {
    init: function () {
        this.$dom = $(this.src);
        this.$dom.on('change', this.notifyChange.bind(this));

        return this;
    },

    populate: function () {
        return this;
    },

    update: function () {
        return this;
    },

    getInitialQuery: function() {
        return this.getQuery();
    }
});

module.exports = {
    SimpleSelectBackend: SimpleSelectBackend,
    MultiSelectBackend: MultiSelectBackend,
    FixedSelectBackend: FixedSelectBackend
};