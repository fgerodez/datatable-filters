'use strict';

var $ = require('jquery');
var BaseFilter = require('./basefilter');

/**
 * SelectFilter
 *
 * Configurable select filter. It can be dynamic (based on the column's data) or
 * fixed (based on a supplied DOM select). It can be single or multivalued
 *
 */
var SelectFilter = function (config) {
    $.extend(this, config);

    this.$dom = this._createSelect().on('change', $.proxy(function () {
        this.selected = this._getSelection();

        /*
         * This can only be true with multiselects. In this case we override
         * the selected value with a whitespace to hide all the data. (The regex
         * will only match cells containing single whitespaces)
         */
        if (this.selected.length == 0) {
            this.selected = [' '];
        }

        this.notifyChange();
    }, this));
};

$.extend(SelectFilter.prototype, BaseFilter, {
    selected: [],

    multiple: false,

    allText: undefined,

    /**
     * If the current filter is fixed (config.src is set), the select tag is
     * fetched with its selector. Otherwise a new select is created
     *
     * @returns {jQuery} The filter's select object
     */
    _createSelect: function () {
        if (this.src) {
            return $(this.src);
        }

        var $select = $('<select class="filtre"/>');

        if (this.multiple) {
            $select.attr('multiple', 'multiple');
        }

        return $select
    },

    /**
     * Populates the select's data. The select is first emptied before being
     * populated with the new options.
     *
     * @param data {Array<String>} The data to add to the select
     */
    _addOptions: function (data) {
        this.$dom.empty();

        if (this.allText) {
            this.$dom.append($('<option/>').val('').text(this.allText));
        }

        var procData = data.filter(this.filterOptions).sort(this.sortOptions);

        $.each(procData, $.proxy(function (key, value) {
            var $option = $('<option/>').val(value).text(value);

            if (this.multiple || $.inArray(value, this.selected) > -1) {
                $option.attr('selected', 'selected');
            }

            this.$dom.append($option);
        }, this));
    },

    _getSelection: function () {
        return this.$dom.find('option:selected').toArray();
    },

    isRegexMatch: function () {
        return true;
    },

    /**
     * @returns {String} The datatable column query text to apply. It can be overridden for
     * specific behavior. Default is to escape regex and concatenate the values
     * with a pipe character
     */
    getQuery: function () {
        return this.selected.map(function (option) {
            if (option.value == '') {
                return '';
            } else {
                return '^' + $.fn.dataTable.util.escapeRegex(option.value) + '$';
            }
        }).join('|');
    },

    /**
     * Populates the select with the column's data
     * Custom rendering can be done in showFilter
     */
    render: function ($container, header, data) {
        this.$dom.attr('name', header);
        this.multiple && this._addOptions(data);

        this.showFilter(this.$dom, $container, header);
    },

    /**
     * @see BaseFilter
     */
    refresh: function (data) {
        if (this.src || this.multiple)
            return;

        this._addOptions(data);
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
    }
});

module.exports = SelectFilter;