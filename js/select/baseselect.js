'use strict';

var $ = require('jquery');
var BaseFilter = require('../basefilter');

var SelectFilter = $.extend({}, BaseFilter, {
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
        return this._getSelection().map(function (value) {
            if (value == this.allText) {
                return '';
            } else {
                return '^' + $.fn.dataTable.util.escapeRegex(value) + '$';
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
        return this.$dom.find('option:selected').toArray().map(function(option) {
            return option.value;
        });
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

    _saveSelection: function() {
        this.selected = this._getSelection();
    },

    _onChange: function() {
        this._saveSelection();
        this.notifyChange();
    }
});

module.exports = SelectFilter;