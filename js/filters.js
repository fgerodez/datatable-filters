'use strict';

var $ = require('jquery');
require('datatables.net')(window, $);
var SelectFilter = require('./selectfilter');
var InputFilter = require('./inputfilter');

/**
 * Filters is a component that manages a list of filters object inside
 * a datatable header row.
 *
 * This constructor binds listeners to various datatable events.
 * it must be called <b>before</b> the datatable initialization (
 * the events are only fired once)
 *
 * @param tableSelector {String} selector for the datatable
 * @param filters {Array} Array of filter objects to add
 */
var Filters = function (settings) {
    this.tableAPI = new $.fn.dataTable.Api(settings);
    this.table = $(this.tableAPI.context[0]);
    this.$header = $(this.table[0].nTHead);
    this.url = this.tableAPI.ajax.url();
    var filters = this.filters;
    var builders = this.builders;

    $.each(settings.aoColumns, function (col, param) {
        if (param.filter) {
            var options = $.extend({column: col}, param.filter.options);
            filters.push(new builders[param.filter.type](options));
        }
    });

    $.map(this.filters, $.proxy(this.applyFilter, this));
    this.table.on('init.dt', $.proxy(this.onDataTableInit(), this));
};

$.extend(Filters.prototype, {

    builders: {
        'select': SelectFilter,
        'input': InputFilter
    },

    /**
     * Table header dom node
     * @type {jQuery}
     */
    $header: null,

    /**
     * Filters array
     * @type {Array<BaseFilter>}
     */
    filters: [],

    /**
     * Table initial ajax URL
     * @type {String}
     */
    url: '',

    /**
     * Refreshes filters for every ajax request
     *
     * @returns {Filters}
     */
    registerAjaxListener: function () {
        this.table.on('xhr.dt', $.proxy(this.refreshFilters, this));

        return this;
    },

    /**
     * Initializes the header HTML elements that will be used to hold the filters.
     * It also registers the main event handler that will react to the filters'
     * value changes.
     *
     * The event name is <b>filterChange</b>. This event must be triggered by the
     * filters when their value is modified by the user (or any other event that
     * should trigger a datatable filter).
     *
     * @returns {Filters}
     */
    setupHeaderRow: function () {
        var $filterHeader = $('<tr class="filters"></tr>');

        $.each(this.tableAPI.columns(':visible').header(), function () {
            $filterHeader.append('<th class="fond-header"></th>');
        });

        this.$header.append($filterHeader);

        return this;
    },

    /**
     * Redraws the datatable
     *
     * @returns {Filters}
     */
    drawTable: function () {
        this.tableAPI.draw();

        return this;
    },

    /**
     * Retrieves the column data (current filter is ignored)
     *
     * @param col {int} The column index (0 based)
     */
    getColumnData: function (col) {
        return this.tableAPI.column(col).data().unique();
    },

    /**
     * Retrieves the column filtered data
     *
     * @param col {int} The column index (0 based)
     *
     * @return An array of values
     */
    getFilteredColumnData: function (col) {
        return this.tableAPI.column(col, {search: 'applied'}).data().unique();
    },

    /**
     * @see this.registerTableListener
     *
     * @returns {Filters}
     */
    onDataTableInit: function () {
        this.setupHeaderRow().registerAjaxListener().renderFilters();

        return this;
    },

    /**
     * Each time a client-side filter changes, applies its new value and refreshes all the filters
     *
     * @param event {Event} event object
     * @param params {Object} event params
     *
     * @return {Filters}
     */
    onClientFilterChange: function (event, params) {
        var filter = params.filter;
        this.applyFilter(filter).drawTable();

        return this;
    },

    /**
     * Each time a client-side filter changes, applies its new value and refreshes all the filters
     *
     * @return {Filters}
     */
    onServerFilterChange: function () {
        var serverQuery = $.grep(this.filters, function (filter) {
            return filter.isServerSide();
        }).map(function (filter) {
            return filter.getServerQuery();
        }).join('&');

        this.tableAPI.ajax.url(this.url + '?' + serverQuery).ajax.reload();

        return this;
    },

    /**
     * Apply the filter value for the given column
     *
     * @param filter {BaseFilter} The filter object
     *
     * @return {Filters}
     */
    applyFilter: function (filter) {
        this.tableAPI.column(filter.getColumn()).search(
            filter.getQuery(),
            filter.isRegexMatch()
            , false);

        return this;
    },

    /**
     * @see this.renderFilter
     *
     * @returns {Filters}
     */
    renderFilters: function () {
        $.map(this.filters, $.proxy(this.renderFilter, this));

        return this;
    },

    /**
     * Asks a filter to render itself and provides an optional container
     * for filters that need to be rendered inside the datatable header row
     *
     * @param filter {BaseFilter} The filter object
     */
    renderFilter: function (filter) {
        var col = filter.getColumn();
        var $colHeader = $(this.tableAPI.column(col).header());
        var $container = this.$header.find('.fond-header:eq(' + col + ')');

        filter.render($container, $colHeader.html(), this.getColumnData(col));

        if (filter.isServerSide()) {
            filter.getFilterDOM().on('update.filters.dt', $.proxy(this.onServerFilterChange, this));
        } else {
            filter.getFilterDOM().on('update.filters.dt', $.proxy(this.onClientFilterChange, this));
        }

        this.refreshFilters();
    },

    /**
     * Refreshes the filters based on the currently displayed data for each column
     *
     * @return {Filters}
     */
    refreshFilters: function () {
        $.each(this.filters, $.proxy(function (idx, filter) {
            filter.refresh(this.getColumnData(filter.column));
        }, this));

        return this;
    }
});

$(document).on('preInit.dt', function (e, settings) {
    new Filters(settings);
});

module.exports = Filters;