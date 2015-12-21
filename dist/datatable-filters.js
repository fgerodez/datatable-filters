(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var $ = (window.$);

/**
 * BaseFilter
 */
var BaseFilter = {

    /**
     * @returns {Boolean} Whether a filter change must trigger a datatable reload.
     * Default is false (client side filter).
     */
    isServerSide: function () {
        return false;
    },

    /**
     * @returns {String} The request parameter associated with this filter (in the form key=param,
     * only used for server side filters)
     */
    getServerQuery: function () {
        return '';
    },

    notifyChange: function () {
        this.$dom.trigger('update.filters.dt', {
            filter: this
        });

        return this;
    },

    /**
     * @returns {String} The filter string to be applied to the datatable column
     */
    getQuery: function () {
        if (!this.hasValue())
            return this.noSelectionQuery();

        return this.selectedQuery();
    },

    register: function(callback) {
        this.$dom.on('update.filters.dt', callback);
    }
};

module.exports = BaseFilter;
},{}],2:[function(require,module,exports){
'use strict';

var $ = (window.$);

/**
 * Filters is a component that manages a list of filters object inside
 * a datatable header row.
 *
 * This constructor binds listeners to various datatable events.
 *
 * @param settings {Object} settings object used to create the datatable
 */
var Filters = function (settings) {
    this.tableAPI = new $.fn.dataTable.Api(settings);
    this.$header = $(this.tableAPI.table().header());
    this.url = this.tableAPI.ajax.url();

    var filters = [];
    var builders = this.builders;
    $.each(settings.aoColumns, function (col, param) {
        if (param.filter) {
            var options = $.extend({column: col}, param.filter);
            filters.push(builders[param.filter.type](options));
        }
    });

    if (filters.length > 0) {
        this.filters = filters;
        this.filters.forEach(function (filter) {
            filter.init();
        });
        this.filters.forEach(this.applyInitialFilter, this);
        this.tableAPI.on('init', this.onDataTableInit.bind(this));
    }
};

$.extend(Filters.prototype, {

    /**
     * Array of filter constructor function. Each function
     * takes a setting object as its single parameter
     */
    builders: {},

    /**
     * Table header dom node
     * @type {jQuery}
     */
    $header: null,

    /**
     * Filters array
     * @type {Array}
     */
    filters: [],

    /**
     * Table initial ajax URL
     * @type {String}
     */
    url: '',

    /**
     * Refreshes filters after each ajax request
     *
     * @returns {Filters}
     */
    registerAjaxListener: function () {
        this.tableAPI.on('xhr', $.proxy(function () {
            this.tableAPI.one('preDraw', $.proxy(this.refreshFilters, this));
        }, this));

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

        this.tableAPI.columns(':visible').header().each(function () {
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
     *
     * @return {jQuery} The unfiltered column data
     */
    getColumnData: function (col) {
        return this.tableAPI.column(col).data().unique();
    },

    /**
     * Retrieves the column filtered data
     *
     * @param col {int} The column index (0 based)
     *
     * @return {jQuery} The filtered column data
     */
    getFilteredColumnData: function (col) {
        return this.tableAPI.column(col, {search: 'applied'}).data().unique();
    },

    /**
     * Actions to execute when the datatable is done initializing.
     * Creates the filter header row, registers ajax listeners and
     * renders filters
     *
     * @returns {Filters}
     */
    onDataTableInit: function () {
        this.setupHeaderRow().registerAjaxListener().renderFilters();

        return this;
    },

    /**
     * When a client-side filter changes, applies its new value
     *
     * @param event {Event} event object
     * @param params {Object} event params
     *
     * @return {Filters}
     */
    onClientFilterChange: function (event, params) {
        this.applyFilter(params.filter).drawTable();

        return this;
    },

    /**
     * When a server-side filter changes, builds the new ajax query and refreshes the table
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
     * Applies the filter value to the related column
     *
     * @param filter The filter object
     *
     * @return {Filters}
     */
    applyFilter: function (filter) {
        this.tableAPI.column(filter.column).search(
            filter.getQuery(),
            filter.isRegexMatch()
            , false);

        return this;
    },

    /**
     * Enables filters to apply an initial column filter, before
     * any data processing/displaying is done.
     *
     * @param filter
     * @returns {Filters}
     */
    applyInitialFilter: function (filter) {
        this.tableAPI.column(filter.column).search(
            filter.getInitialQuery(),
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
        this.filters.forEach(this.renderFilter, this);

        return this;
    },

    /**
     * Asks a filter to render itself and provides an optional container
     * for filters that need to be rendered inside the datatable header row
     *
     * @param filter The filter object
     */
    renderFilter: function (filter) {
        var col = filter.column;
        var $colHeader = $(this.tableAPI.column(col).header());
        var $container = this.$header.find('.fond-header:eq(' + col + ')');

        if (filter.isServerSide()) {
            filter.register($.proxy(this.onServerFilterChange, this));
        } else {
            filter.register($.proxy(this.onClientFilterChange, this));
        }

        filter.render($container, $colHeader.html(), this.getColumnData(col));
    },

    /**
     * Refreshes the filters based on the currently displayed data for each column
     *
     * @return {Filters}
     */
    refreshFilters: function () {
        this.filters.forEach(function (filter) {
            filter.refresh(this.getColumnData(filter.column));
            this.applyFilter(filter);
        }, this);

        this.drawTable();

        return this;
    }
});

$(document).on('preInit.dt', function (e, settings) {
    new Filters(settings);
});

module.exports = Filters;
},{}],3:[function(require,module,exports){
'use strict';

var $ = (window.$);
var BaseFilter = require('../basefilter');
var SimpleRenderer = require('../renderer/simple');
var Filters = require('../filters');

var InputFilter = $.extend({}, BaseFilter, SimpleRenderer, {

    init: function () {
        this.$dom = $('<input class="filtre"/>');
        this.$dom.on('input', this.notifyChange.bind(this));

        return this;
    },

    populate: function () {
        return this;
    },

    update: function () {
        return this;
    },

    noSelectionQuery: function () {
        return '';
    },

    isRegexMatch: function () {
        return true;
    },

    hasValue: function () {
        return this.$dom.val() != '';
    },

    selectedQuery: function () {
        return this.$dom.val();
    },

    getInitialQuery: function () {
        return '';
    }
});

Filters.prototype.builders.input = function(settings) {
  return $.extend({}, InputFilter, settings);
};

module.exports = InputFilter;
},{"../basefilter":1,"../filters":2,"../renderer/simple":5}],4:[function(require,module,exports){
'use strict';

require('./select/simpleselect');
require('./select/multiselect');
require('./select/fixedselect');
require('./input/input');
require('./filters');
},{"./filters":2,"./input/input":3,"./select/fixedselect":7,"./select/multiselect":8,"./select/simpleselect":10}],5:[function(require,module,exports){
'use strict';

var $ = (window.$);

var SimpleRenderer = {
    render: function ($container, header, data) {
        this.populate(data);
        this.showFilter(this.$dom, $container, header, data);

        return this;
    },

    showFilter: function($dom, $container, header, data) {
        $container.append(this.$dom);
        this.$dom.attr('name', header).attr('placeholder', header).show();
    },

    refresh: function (data) {
        this.update(data);

        return this;
    }
};

module.exports = SimpleRenderer;
},{}],6:[function(require,module,exports){
'use strict';

var $ = (window.$);
var BaseFilter = require('../basefilter');
var SimpleRenderer = require('../renderer/simple');
var BootstrapRenderer = require('./renderer/bootstrap');

/**
 * SelectFilter regroups common behavior for select filters
 */
var SelectFilter = $.extend({}, BaseFilter, {
    selected: [],

    /**
     * @returns {string} Returns an always false regex to hide every records
     * when no option is selected
     */
    noSelectionQuery: function () {
        return '$^';
    },

    /**
     * @returns {boolean} True. Select filters always use regex
     */
    isRegexMatch: function () {
        return true;
    },

    /**
     * @returns {boolean} Returns true if at least one option is selected
     */
    hasValue: function () {
        return this._getSelection().length > 0;
    },

    /**
     * @returns {String} The column filter query to apply. Selected option values
     * are concatenated into a string using the pipe character (regex or)
     */
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

    /**
     * @returns {Array<String>} The array of selected values
     * @private
     */
    _getSelection: function () {
        return this.$dom.find('option:selected').toArray().map(function(option) {
            return option.value;
        });
    },

    /**
     *
     * @returns {*|Array} The array of non selected values
     * @private
     */
    _getNotSelected: function() {
        return this.$dom.find(':not(option:selected)').toArray().map(function(option) {
            return option.value;
        });
    },

    /**
     * For each element in the data object, creates an option element using the function
     * fnCreate
     *
     * @param data {jQuery} The data to add to the select
     * @param fnCreate {Function} The function to use to create the options
     * @private
     */
    _addOptions: function (data, fnCreate) {
        this.$dom.empty();

        if (this.allText)
            fnCreate.call(this, this.allText);

        data.toArray().filter(this.filterOptions).sort(this.sortOptions).forEach(fnCreate, this);
    },

    /**
     * Creates a selected option
     *
     * @param value {String} The option value
     * @private
     */
    _addSelectedOption: function (value) {
        this.$dom.append($('<option/>')
            .val(value)
            .text(value)
            .attr('selected', 'selected')
        );
    },

    /**
     * Creates an option with the selected flag based on the
     * current filter state
     *
     * @param value {String} The option value
     * @private
     */
    _refreshOption: function (value) {
        var $option = $('<option/>')
            .val(value)
            .text(value);

        if ($.inArray(value, this.selected) > -1)
            $option.attr('selected', 'selected');

        this.$dom.append($option);
    },

    /**
     * Takes a snapshot of the current selection state
     *
     * @private
     */
    _saveSelection: function() {
        this.selected = this._getSelection();
    },

    /**
     * Whenever the select state changes, save its new state and
     * notify the listening component
     *
     * @private
     */
    _onChange: function() {
        this._saveSelection();
        this.notifyChange();
    }
});

var builder = function(settings) {
    var renderer = SimpleRenderer;

    if (settings.renderer == 'bootstrap')
        renderer = BootstrapRenderer;

    return $.extend({}, this, renderer, settings);
};

module.exports = {
    SelectFilter: SelectFilter,
    builder: builder
};
},{"../basefilter":1,"../renderer/simple":5,"./renderer/bootstrap":9}],7:[function(require,module,exports){
'use strict';

var $ = (window.$);
var Filters = require('../filters');
var BaseSelect = require('./baseselect');

var FixedSelectFilter = $.extend({}, BaseSelect.SelectFilter, {

    /**
     * Simply saves a handle on the provided source select
     *
     * @returns {FixedSelectFilter}
     */
    init: function () {
        this.$dom = $(this.src);
        this.$dom.on('change', this.notifyChange.bind(this));

        return this;
    },

    /**
     * No action for fixed filters: the provided select is used as is
     *
     * @returns {FixedSelectFilter}
     */
    populate: function () {
        return this;
    },

    /**
     * No update for fixed filters: the provided select is never changed
     *
     * @returns {FixedSelectFilter}
     */
    update: function () {
        return this;
    },

    /**
     * Fixed filters can be used to provide initial filters to apply to the
     * datatable.
     *
     * @returns {*|String}
     */
    getInitialQuery: function() {
        return this.getQuery();
    }
});

Filters.prototype.builders.fixedselect = BaseSelect.builder.bind(FixedSelectFilter);

module.exports = FixedSelectFilter;
},{"../filters":2,"./baseselect":6}],8:[function(require,module,exports){
'use strict';

var $ = (window.$);
var Filters = require('../filters');
var BaseSelect = require('./baseselect');

var MultiSelectFilter = $.extend({}, BaseSelect.SelectFilter, {

    /**
     * Initializes a multiselect dom object
     *
     * @returns {MultiSelectFilter}
     */
    init: function () {
        this.$dom = $('<select class="filtre"/>').attr('multiple', 'multiple');
        this.$dom.on('change', this._onChange.bind(this));

        return this;
    },

    /**
     * Populates the multiselect with 'selected' options by default
     *
     * @param data
     * @returns {MultiSelectFilter}
     */
    populate: function (data) {
        this._addOptions(data, this._addSelectedOption);
        this._onChange();

        return this;
    },

    /**
     * If the 'all' option is selected, sets the new options as 'selected'.
     * Otherwise, adds the options based on the filter state
     *
     * @param data
     * @returns {MultiSelectFilter}
     */
    update: function (data) {
        if ($.inArray(this.allText, this.selected) > -1 || this._getNotSelected().length == 0)
            this._addOptions(data, this._addSelectedOption);
        else
            this._addOptions(data, this._refreshOption);

        return this;
    },

    /**
     * This filter is dynamic, it can't be used for initial filtering
     *
     * @returns {string}
     */
    getInitialQuery: function() {
        return '';
    }
});

Filters.prototype.builders.multiselect = BaseSelect.builder.bind(MultiSelectFilter);

module.exports = MultiSelectFilter;
},{"../filters":2,"./baseselect":6}],9:[function(require,module,exports){
'use strict';

var BootstrapRenderer = {
    render: function ($container, header, data) {
        this.populate(data);
        this.showFilter(this.$dom, $container, header, data);

        var defaultOptions = {
            buttonText: function (options) {
                var nbSelected = $(options).filter(':selected').length;
                if(nbSelected === 0) {
                    return header;
                }
                return header + ' (' + nbSelected + ')';
            }
        };

        this.$dom.multiselect($.extend(defaultOptions, this.rendererOptions));

        return this;
    },

    showFilter: function($dom, $container, header, data) {
        $container.append(this.$dom);
    },

    refresh: function (data) {
        this.update(data);
        this.$dom.multiselect('rebuild');

        return this;
    }
};

module.exports = BootstrapRenderer;
},{}],10:[function(require,module,exports){
'use strict';

var $ = (window.$);
var Filters = require('../filters');
var BaseSelect = require('./baseselect');

var SimpleSelectFilter = $.extend({}, BaseSelect.SelectFilter, {

    /**
     * Creates a simple select
     *
     * @returns {SimpleSelectFilter}
     */
    init: function () {
        this.$dom = $('<select class="filtre"/>');
        this.$dom.on('change', this._onChange.bind(this));

        return this;
    },

    /**
     * Adds all options without specifying the 'selected' flag
     * (the first option is selected by default)
     *
     * @param data
     * @returns {SimpleSelectFilter}
     */
    populate: function (data) {
        this._addOptions(data, this._refreshOption);
        this._onChange();

        return this;
    },

    /**
     * Refresh the options based on the filter state
     *
     * @param data
     * @returns {SimpleSelectFilter}
     */
    update: function (data) {
        this._addOptions(data, this._refreshOption);

        return this;
    },

    /**
     * This filter is dynamic, it can't be used for initial filtering
     *
     * @returns {string}
     */
    getInitialQuery: function() {
        return '';
    }
});

Filters.prototype.builders.select = BaseSelect.builder.bind(SimpleSelectFilter);

module.exports = SimpleSelectFilter;
},{"../filters":2,"./baseselect":6}]},{},[4])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3Vzci9sb2NhbC9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsImpzL2Jhc2VmaWx0ZXIuanMiLCJqcy9maWx0ZXJzLmpzIiwianMvaW5wdXQvaW5wdXQuanMiLCJqcy9tYWluLmpzIiwianMvcmVuZGVyZXIvc2ltcGxlLmpzIiwianMvc2VsZWN0L2Jhc2VzZWxlY3QuanMiLCJqcy9zZWxlY3QvZml4ZWRzZWxlY3QuanMiLCJqcy9zZWxlY3QvbXVsdGlzZWxlY3QuanMiLCJqcy9zZWxlY3QvcmVuZGVyZXIvYm9vdHN0cmFwLmpzIiwianMvc2VsZWN0L3NpbXBsZXNlbGVjdC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25RQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgJCA9ICh3aW5kb3cuJCk7XG5cbi8qKlxuICogQmFzZUZpbHRlclxuICovXG52YXIgQmFzZUZpbHRlciA9IHtcblxuICAgIC8qKlxuICAgICAqIEByZXR1cm5zIHtCb29sZWFufSBXaGV0aGVyIGEgZmlsdGVyIGNoYW5nZSBtdXN0IHRyaWdnZXIgYSBkYXRhdGFibGUgcmVsb2FkLlxuICAgICAqIERlZmF1bHQgaXMgZmFsc2UgKGNsaWVudCBzaWRlIGZpbHRlcikuXG4gICAgICovXG4gICAgaXNTZXJ2ZXJTaWRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHJldHVybnMge1N0cmluZ30gVGhlIHJlcXVlc3QgcGFyYW1ldGVyIGFzc29jaWF0ZWQgd2l0aCB0aGlzIGZpbHRlciAoaW4gdGhlIGZvcm0ga2V5PXBhcmFtLFxuICAgICAqIG9ubHkgdXNlZCBmb3Igc2VydmVyIHNpZGUgZmlsdGVycylcbiAgICAgKi9cbiAgICBnZXRTZXJ2ZXJRdWVyeTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gJyc7XG4gICAgfSxcblxuICAgIG5vdGlmeUNoYW5nZTogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLiRkb20udHJpZ2dlcigndXBkYXRlLmZpbHRlcnMuZHQnLCB7XG4gICAgICAgICAgICBmaWx0ZXI6IHRoaXNcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBmaWx0ZXIgc3RyaW5nIHRvIGJlIGFwcGxpZWQgdG8gdGhlIGRhdGF0YWJsZSBjb2x1bW5cbiAgICAgKi9cbiAgICBnZXRRdWVyeTogZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoIXRoaXMuaGFzVmFsdWUoKSlcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm5vU2VsZWN0aW9uUXVlcnkoKTtcblxuICAgICAgICByZXR1cm4gdGhpcy5zZWxlY3RlZFF1ZXJ5KCk7XG4gICAgfSxcblxuICAgIHJlZ2lzdGVyOiBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgICAgICB0aGlzLiRkb20ub24oJ3VwZGF0ZS5maWx0ZXJzLmR0JywgY2FsbGJhY2spO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQmFzZUZpbHRlcjsiLCIndXNlIHN0cmljdCc7XG5cbnZhciAkID0gKHdpbmRvdy4kKTtcblxuLyoqXG4gKiBGaWx0ZXJzIGlzIGEgY29tcG9uZW50IHRoYXQgbWFuYWdlcyBhIGxpc3Qgb2YgZmlsdGVycyBvYmplY3QgaW5zaWRlXG4gKiBhIGRhdGF0YWJsZSBoZWFkZXIgcm93LlxuICpcbiAqIFRoaXMgY29uc3RydWN0b3IgYmluZHMgbGlzdGVuZXJzIHRvIHZhcmlvdXMgZGF0YXRhYmxlIGV2ZW50cy5cbiAqXG4gKiBAcGFyYW0gc2V0dGluZ3Mge09iamVjdH0gc2V0dGluZ3Mgb2JqZWN0IHVzZWQgdG8gY3JlYXRlIHRoZSBkYXRhdGFibGVcbiAqL1xudmFyIEZpbHRlcnMgPSBmdW5jdGlvbiAoc2V0dGluZ3MpIHtcbiAgICB0aGlzLnRhYmxlQVBJID0gbmV3ICQuZm4uZGF0YVRhYmxlLkFwaShzZXR0aW5ncyk7XG4gICAgdGhpcy4kaGVhZGVyID0gJCh0aGlzLnRhYmxlQVBJLnRhYmxlKCkuaGVhZGVyKCkpO1xuICAgIHRoaXMudXJsID0gdGhpcy50YWJsZUFQSS5hamF4LnVybCgpO1xuXG4gICAgdmFyIGZpbHRlcnMgPSBbXTtcbiAgICB2YXIgYnVpbGRlcnMgPSB0aGlzLmJ1aWxkZXJzO1xuICAgICQuZWFjaChzZXR0aW5ncy5hb0NvbHVtbnMsIGZ1bmN0aW9uIChjb2wsIHBhcmFtKSB7XG4gICAgICAgIGlmIChwYXJhbS5maWx0ZXIpIHtcbiAgICAgICAgICAgIHZhciBvcHRpb25zID0gJC5leHRlbmQoe2NvbHVtbjogY29sfSwgcGFyYW0uZmlsdGVyKTtcbiAgICAgICAgICAgIGZpbHRlcnMucHVzaChidWlsZGVyc1twYXJhbS5maWx0ZXIudHlwZV0ob3B0aW9ucykpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAoZmlsdGVycy5sZW5ndGggPiAwKSB7XG4gICAgICAgIHRoaXMuZmlsdGVycyA9IGZpbHRlcnM7XG4gICAgICAgIHRoaXMuZmlsdGVycy5mb3JFYWNoKGZ1bmN0aW9uIChmaWx0ZXIpIHtcbiAgICAgICAgICAgIGZpbHRlci5pbml0KCk7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLmZpbHRlcnMuZm9yRWFjaCh0aGlzLmFwcGx5SW5pdGlhbEZpbHRlciwgdGhpcyk7XG4gICAgICAgIHRoaXMudGFibGVBUEkub24oJ2luaXQnLCB0aGlzLm9uRGF0YVRhYmxlSW5pdC5iaW5kKHRoaXMpKTtcbiAgICB9XG59O1xuXG4kLmV4dGVuZChGaWx0ZXJzLnByb3RvdHlwZSwge1xuXG4gICAgLyoqXG4gICAgICogQXJyYXkgb2YgZmlsdGVyIGNvbnN0cnVjdG9yIGZ1bmN0aW9uLiBFYWNoIGZ1bmN0aW9uXG4gICAgICogdGFrZXMgYSBzZXR0aW5nIG9iamVjdCBhcyBpdHMgc2luZ2xlIHBhcmFtZXRlclxuICAgICAqL1xuICAgIGJ1aWxkZXJzOiB7fSxcblxuICAgIC8qKlxuICAgICAqIFRhYmxlIGhlYWRlciBkb20gbm9kZVxuICAgICAqIEB0eXBlIHtqUXVlcnl9XG4gICAgICovXG4gICAgJGhlYWRlcjogbnVsbCxcblxuICAgIC8qKlxuICAgICAqIEZpbHRlcnMgYXJyYXlcbiAgICAgKiBAdHlwZSB7QXJyYXl9XG4gICAgICovXG4gICAgZmlsdGVyczogW10sXG5cbiAgICAvKipcbiAgICAgKiBUYWJsZSBpbml0aWFsIGFqYXggVVJMXG4gICAgICogQHR5cGUge1N0cmluZ31cbiAgICAgKi9cbiAgICB1cmw6ICcnLFxuXG4gICAgLyoqXG4gICAgICogUmVmcmVzaGVzIGZpbHRlcnMgYWZ0ZXIgZWFjaCBhamF4IHJlcXVlc3RcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJzfVxuICAgICAqL1xuICAgIHJlZ2lzdGVyQWpheExpc3RlbmVyOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMudGFibGVBUEkub24oJ3hocicsICQucHJveHkoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy50YWJsZUFQSS5vbmUoJ3ByZURyYXcnLCAkLnByb3h5KHRoaXMucmVmcmVzaEZpbHRlcnMsIHRoaXMpKTtcbiAgICAgICAgfSwgdGhpcykpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBJbml0aWFsaXplcyB0aGUgaGVhZGVyIEhUTUwgZWxlbWVudHMgdGhhdCB3aWxsIGJlIHVzZWQgdG8gaG9sZCB0aGUgZmlsdGVycy5cbiAgICAgKiBJdCBhbHNvIHJlZ2lzdGVycyB0aGUgbWFpbiBldmVudCBoYW5kbGVyIHRoYXQgd2lsbCByZWFjdCB0byB0aGUgZmlsdGVycydcbiAgICAgKiB2YWx1ZSBjaGFuZ2VzLlxuICAgICAqXG4gICAgICogVGhlIGV2ZW50IG5hbWUgaXMgPGI+ZmlsdGVyQ2hhbmdlPC9iPi4gVGhpcyBldmVudCBtdXN0IGJlIHRyaWdnZXJlZCBieSB0aGVcbiAgICAgKiBmaWx0ZXJzIHdoZW4gdGhlaXIgdmFsdWUgaXMgbW9kaWZpZWQgYnkgdGhlIHVzZXIgKG9yIGFueSBvdGhlciBldmVudCB0aGF0XG4gICAgICogc2hvdWxkIHRyaWdnZXIgYSBkYXRhdGFibGUgZmlsdGVyKS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJzfVxuICAgICAqL1xuICAgIHNldHVwSGVhZGVyUm93OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciAkZmlsdGVySGVhZGVyID0gJCgnPHRyIGNsYXNzPVwiZmlsdGVyc1wiPjwvdHI+Jyk7XG5cbiAgICAgICAgdGhpcy50YWJsZUFQSS5jb2x1bW5zKCc6dmlzaWJsZScpLmhlYWRlcigpLmVhY2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgJGZpbHRlckhlYWRlci5hcHBlbmQoJzx0aCBjbGFzcz1cImZvbmQtaGVhZGVyXCI+PC90aD4nKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy4kaGVhZGVyLmFwcGVuZCgkZmlsdGVySGVhZGVyKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmVkcmF3cyB0aGUgZGF0YXRhYmxlXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7RmlsdGVyc31cbiAgICAgKi9cbiAgICBkcmF3VGFibGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy50YWJsZUFQSS5kcmF3KCk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHJpZXZlcyB0aGUgY29sdW1uIGRhdGEgKGN1cnJlbnQgZmlsdGVyIGlzIGlnbm9yZWQpXG4gICAgICpcbiAgICAgKiBAcGFyYW0gY29sIHtpbnR9IFRoZSBjb2x1bW4gaW5kZXggKDAgYmFzZWQpXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtqUXVlcnl9IFRoZSB1bmZpbHRlcmVkIGNvbHVtbiBkYXRhXG4gICAgICovXG4gICAgZ2V0Q29sdW1uRGF0YTogZnVuY3Rpb24gKGNvbCkge1xuICAgICAgICByZXR1cm4gdGhpcy50YWJsZUFQSS5jb2x1bW4oY29sKS5kYXRhKCkudW5pcXVlKCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHJpZXZlcyB0aGUgY29sdW1uIGZpbHRlcmVkIGRhdGFcbiAgICAgKlxuICAgICAqIEBwYXJhbSBjb2wge2ludH0gVGhlIGNvbHVtbiBpbmRleCAoMCBiYXNlZClcbiAgICAgKlxuICAgICAqIEByZXR1cm4ge2pRdWVyeX0gVGhlIGZpbHRlcmVkIGNvbHVtbiBkYXRhXG4gICAgICovXG4gICAgZ2V0RmlsdGVyZWRDb2x1bW5EYXRhOiBmdW5jdGlvbiAoY29sKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRhYmxlQVBJLmNvbHVtbihjb2wsIHtzZWFyY2g6ICdhcHBsaWVkJ30pLmRhdGEoKS51bmlxdWUoKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQWN0aW9ucyB0byBleGVjdXRlIHdoZW4gdGhlIGRhdGF0YWJsZSBpcyBkb25lIGluaXRpYWxpemluZy5cbiAgICAgKiBDcmVhdGVzIHRoZSBmaWx0ZXIgaGVhZGVyIHJvdywgcmVnaXN0ZXJzIGFqYXggbGlzdGVuZXJzIGFuZFxuICAgICAqIHJlbmRlcnMgZmlsdGVyc1xuICAgICAqXG4gICAgICogQHJldHVybnMge0ZpbHRlcnN9XG4gICAgICovXG4gICAgb25EYXRhVGFibGVJbml0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuc2V0dXBIZWFkZXJSb3coKS5yZWdpc3RlckFqYXhMaXN0ZW5lcigpLnJlbmRlckZpbHRlcnMoKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogV2hlbiBhIGNsaWVudC1zaWRlIGZpbHRlciBjaGFuZ2VzLCBhcHBsaWVzIGl0cyBuZXcgdmFsdWVcbiAgICAgKlxuICAgICAqIEBwYXJhbSBldmVudCB7RXZlbnR9IGV2ZW50IG9iamVjdFxuICAgICAqIEBwYXJhbSBwYXJhbXMge09iamVjdH0gZXZlbnQgcGFyYW1zXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtGaWx0ZXJzfVxuICAgICAqL1xuICAgIG9uQ2xpZW50RmlsdGVyQ2hhbmdlOiBmdW5jdGlvbiAoZXZlbnQsIHBhcmFtcykge1xuICAgICAgICB0aGlzLmFwcGx5RmlsdGVyKHBhcmFtcy5maWx0ZXIpLmRyYXdUYWJsZSgpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBXaGVuIGEgc2VydmVyLXNpZGUgZmlsdGVyIGNoYW5nZXMsIGJ1aWxkcyB0aGUgbmV3IGFqYXggcXVlcnkgYW5kIHJlZnJlc2hlcyB0aGUgdGFibGVcbiAgICAgKlxuICAgICAqIEByZXR1cm4ge0ZpbHRlcnN9XG4gICAgICovXG4gICAgb25TZXJ2ZXJGaWx0ZXJDaGFuZ2U6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHNlcnZlclF1ZXJ5ID0gJC5ncmVwKHRoaXMuZmlsdGVycywgZnVuY3Rpb24gKGZpbHRlcikge1xuICAgICAgICAgICAgcmV0dXJuIGZpbHRlci5pc1NlcnZlclNpZGUoKTtcbiAgICAgICAgfSkubWFwKGZ1bmN0aW9uIChmaWx0ZXIpIHtcbiAgICAgICAgICAgIHJldHVybiBmaWx0ZXIuZ2V0U2VydmVyUXVlcnkoKTtcbiAgICAgICAgfSkuam9pbignJicpO1xuXG4gICAgICAgIHRoaXMudGFibGVBUEkuYWpheC51cmwodGhpcy51cmwgKyAnPycgKyBzZXJ2ZXJRdWVyeSkuYWpheC5yZWxvYWQoKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQXBwbGllcyB0aGUgZmlsdGVyIHZhbHVlIHRvIHRoZSByZWxhdGVkIGNvbHVtblxuICAgICAqXG4gICAgICogQHBhcmFtIGZpbHRlciBUaGUgZmlsdGVyIG9iamVjdFxuICAgICAqXG4gICAgICogQHJldHVybiB7RmlsdGVyc31cbiAgICAgKi9cbiAgICBhcHBseUZpbHRlcjogZnVuY3Rpb24gKGZpbHRlcikge1xuICAgICAgICB0aGlzLnRhYmxlQVBJLmNvbHVtbihmaWx0ZXIuY29sdW1uKS5zZWFyY2goXG4gICAgICAgICAgICBmaWx0ZXIuZ2V0UXVlcnkoKSxcbiAgICAgICAgICAgIGZpbHRlci5pc1JlZ2V4TWF0Y2goKVxuICAgICAgICAgICAgLCBmYWxzZSk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEVuYWJsZXMgZmlsdGVycyB0byBhcHBseSBhbiBpbml0aWFsIGNvbHVtbiBmaWx0ZXIsIGJlZm9yZVxuICAgICAqIGFueSBkYXRhIHByb2Nlc3NpbmcvZGlzcGxheWluZyBpcyBkb25lLlxuICAgICAqXG4gICAgICogQHBhcmFtIGZpbHRlclxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJzfVxuICAgICAqL1xuICAgIGFwcGx5SW5pdGlhbEZpbHRlcjogZnVuY3Rpb24gKGZpbHRlcikge1xuICAgICAgICB0aGlzLnRhYmxlQVBJLmNvbHVtbihmaWx0ZXIuY29sdW1uKS5zZWFyY2goXG4gICAgICAgICAgICBmaWx0ZXIuZ2V0SW5pdGlhbFF1ZXJ5KCksXG4gICAgICAgICAgICBmaWx0ZXIuaXNSZWdleE1hdGNoKClcbiAgICAgICAgICAgICwgZmFsc2UpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAc2VlIHRoaXMucmVuZGVyRmlsdGVyXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7RmlsdGVyc31cbiAgICAgKi9cbiAgICByZW5kZXJGaWx0ZXJzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuZmlsdGVycy5mb3JFYWNoKHRoaXMucmVuZGVyRmlsdGVyLCB0aGlzKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQXNrcyBhIGZpbHRlciB0byByZW5kZXIgaXRzZWxmIGFuZCBwcm92aWRlcyBhbiBvcHRpb25hbCBjb250YWluZXJcbiAgICAgKiBmb3IgZmlsdGVycyB0aGF0IG5lZWQgdG8gYmUgcmVuZGVyZWQgaW5zaWRlIHRoZSBkYXRhdGFibGUgaGVhZGVyIHJvd1xuICAgICAqXG4gICAgICogQHBhcmFtIGZpbHRlciBUaGUgZmlsdGVyIG9iamVjdFxuICAgICAqL1xuICAgIHJlbmRlckZpbHRlcjogZnVuY3Rpb24gKGZpbHRlcikge1xuICAgICAgICB2YXIgY29sID0gZmlsdGVyLmNvbHVtbjtcbiAgICAgICAgdmFyICRjb2xIZWFkZXIgPSAkKHRoaXMudGFibGVBUEkuY29sdW1uKGNvbCkuaGVhZGVyKCkpO1xuICAgICAgICB2YXIgJGNvbnRhaW5lciA9IHRoaXMuJGhlYWRlci5maW5kKCcuZm9uZC1oZWFkZXI6ZXEoJyArIGNvbCArICcpJyk7XG5cbiAgICAgICAgaWYgKGZpbHRlci5pc1NlcnZlclNpZGUoKSkge1xuICAgICAgICAgICAgZmlsdGVyLnJlZ2lzdGVyKCQucHJveHkodGhpcy5vblNlcnZlckZpbHRlckNoYW5nZSwgdGhpcykpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZmlsdGVyLnJlZ2lzdGVyKCQucHJveHkodGhpcy5vbkNsaWVudEZpbHRlckNoYW5nZSwgdGhpcykpO1xuICAgICAgICB9XG5cbiAgICAgICAgZmlsdGVyLnJlbmRlcigkY29udGFpbmVyLCAkY29sSGVhZGVyLmh0bWwoKSwgdGhpcy5nZXRDb2x1bW5EYXRhKGNvbCkpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZWZyZXNoZXMgdGhlIGZpbHRlcnMgYmFzZWQgb24gdGhlIGN1cnJlbnRseSBkaXNwbGF5ZWQgZGF0YSBmb3IgZWFjaCBjb2x1bW5cbiAgICAgKlxuICAgICAqIEByZXR1cm4ge0ZpbHRlcnN9XG4gICAgICovXG4gICAgcmVmcmVzaEZpbHRlcnM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5maWx0ZXJzLmZvckVhY2goZnVuY3Rpb24gKGZpbHRlcikge1xuICAgICAgICAgICAgZmlsdGVyLnJlZnJlc2godGhpcy5nZXRDb2x1bW5EYXRhKGZpbHRlci5jb2x1bW4pKTtcbiAgICAgICAgICAgIHRoaXMuYXBwbHlGaWx0ZXIoZmlsdGVyKTtcbiAgICAgICAgfSwgdGhpcyk7XG5cbiAgICAgICAgdGhpcy5kcmF3VGFibGUoKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG59KTtcblxuJChkb2N1bWVudCkub24oJ3ByZUluaXQuZHQnLCBmdW5jdGlvbiAoZSwgc2V0dGluZ3MpIHtcbiAgICBuZXcgRmlsdGVycyhzZXR0aW5ncyk7XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBGaWx0ZXJzOyIsIid1c2Ugc3RyaWN0JztcblxudmFyICQgPSAod2luZG93LiQpO1xudmFyIEJhc2VGaWx0ZXIgPSByZXF1aXJlKCcuLi9iYXNlZmlsdGVyJyk7XG52YXIgU2ltcGxlUmVuZGVyZXIgPSByZXF1aXJlKCcuLi9yZW5kZXJlci9zaW1wbGUnKTtcbnZhciBGaWx0ZXJzID0gcmVxdWlyZSgnLi4vZmlsdGVycycpO1xuXG52YXIgSW5wdXRGaWx0ZXIgPSAkLmV4dGVuZCh7fSwgQmFzZUZpbHRlciwgU2ltcGxlUmVuZGVyZXIsIHtcblxuICAgIGluaXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy4kZG9tID0gJCgnPGlucHV0IGNsYXNzPVwiZmlsdHJlXCIvPicpO1xuICAgICAgICB0aGlzLiRkb20ub24oJ2lucHV0JywgdGhpcy5ub3RpZnlDaGFuZ2UuYmluZCh0aGlzKSk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIHBvcHVsYXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICB1cGRhdGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIG5vU2VsZWN0aW9uUXVlcnk6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuICcnO1xuICAgIH0sXG5cbiAgICBpc1JlZ2V4TWF0Y2g6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSxcblxuICAgIGhhc1ZhbHVlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLiRkb20udmFsKCkgIT0gJyc7XG4gICAgfSxcblxuICAgIHNlbGVjdGVkUXVlcnk6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuJGRvbS52YWwoKTtcbiAgICB9LFxuXG4gICAgZ2V0SW5pdGlhbFF1ZXJ5OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiAnJztcbiAgICB9XG59KTtcblxuRmlsdGVycy5wcm90b3R5cGUuYnVpbGRlcnMuaW5wdXQgPSBmdW5jdGlvbihzZXR0aW5ncykge1xuICByZXR1cm4gJC5leHRlbmQoe30sIElucHV0RmlsdGVyLCBzZXR0aW5ncyk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IElucHV0RmlsdGVyOyIsIid1c2Ugc3RyaWN0JztcblxucmVxdWlyZSgnLi9zZWxlY3Qvc2ltcGxlc2VsZWN0Jyk7XG5yZXF1aXJlKCcuL3NlbGVjdC9tdWx0aXNlbGVjdCcpO1xucmVxdWlyZSgnLi9zZWxlY3QvZml4ZWRzZWxlY3QnKTtcbnJlcXVpcmUoJy4vaW5wdXQvaW5wdXQnKTtcbnJlcXVpcmUoJy4vZmlsdGVycycpOyIsIid1c2Ugc3RyaWN0JztcblxudmFyICQgPSAod2luZG93LiQpO1xuXG52YXIgU2ltcGxlUmVuZGVyZXIgPSB7XG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoJGNvbnRhaW5lciwgaGVhZGVyLCBkYXRhKSB7XG4gICAgICAgIHRoaXMucG9wdWxhdGUoZGF0YSk7XG4gICAgICAgIHRoaXMuc2hvd0ZpbHRlcih0aGlzLiRkb20sICRjb250YWluZXIsIGhlYWRlciwgZGF0YSk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIHNob3dGaWx0ZXI6IGZ1bmN0aW9uKCRkb20sICRjb250YWluZXIsIGhlYWRlciwgZGF0YSkge1xuICAgICAgICAkY29udGFpbmVyLmFwcGVuZCh0aGlzLiRkb20pO1xuICAgICAgICB0aGlzLiRkb20uYXR0cignbmFtZScsIGhlYWRlcikuYXR0cigncGxhY2Vob2xkZXInLCBoZWFkZXIpLnNob3coKTtcbiAgICB9LFxuXG4gICAgcmVmcmVzaDogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgdGhpcy51cGRhdGUoZGF0YSk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBTaW1wbGVSZW5kZXJlcjsiLCIndXNlIHN0cmljdCc7XG5cbnZhciAkID0gKHdpbmRvdy4kKTtcbnZhciBCYXNlRmlsdGVyID0gcmVxdWlyZSgnLi4vYmFzZWZpbHRlcicpO1xudmFyIFNpbXBsZVJlbmRlcmVyID0gcmVxdWlyZSgnLi4vcmVuZGVyZXIvc2ltcGxlJyk7XG52YXIgQm9vdHN0cmFwUmVuZGVyZXIgPSByZXF1aXJlKCcuL3JlbmRlcmVyL2Jvb3RzdHJhcCcpO1xuXG4vKipcbiAqIFNlbGVjdEZpbHRlciByZWdyb3VwcyBjb21tb24gYmVoYXZpb3IgZm9yIHNlbGVjdCBmaWx0ZXJzXG4gKi9cbnZhciBTZWxlY3RGaWx0ZXIgPSAkLmV4dGVuZCh7fSwgQmFzZUZpbHRlciwge1xuICAgIHNlbGVjdGVkOiBbXSxcblxuICAgIC8qKlxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgYW4gYWx3YXlzIGZhbHNlIHJlZ2V4IHRvIGhpZGUgZXZlcnkgcmVjb3Jkc1xuICAgICAqIHdoZW4gbm8gb3B0aW9uIGlzIHNlbGVjdGVkXG4gICAgICovXG4gICAgbm9TZWxlY3Rpb25RdWVyeTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gJyReJztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUuIFNlbGVjdCBmaWx0ZXJzIGFsd2F5cyB1c2UgcmVnZXhcbiAgICAgKi9cbiAgICBpc1JlZ2V4TWF0Y2g6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBSZXR1cm5zIHRydWUgaWYgYXQgbGVhc3Qgb25lIG9wdGlvbiBpcyBzZWxlY3RlZFxuICAgICAqL1xuICAgIGhhc1ZhbHVlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9nZXRTZWxlY3Rpb24oKS5sZW5ndGggPiAwO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgY29sdW1uIGZpbHRlciBxdWVyeSB0byBhcHBseS4gU2VsZWN0ZWQgb3B0aW9uIHZhbHVlc1xuICAgICAqIGFyZSBjb25jYXRlbmF0ZWQgaW50byBhIHN0cmluZyB1c2luZyB0aGUgcGlwZSBjaGFyYWN0ZXIgKHJlZ2V4IG9yKVxuICAgICAqL1xuICAgIHNlbGVjdGVkUXVlcnk6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2dldFNlbGVjdGlvbigpLm1hcChmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgIGlmICh2YWx1ZSA9PSB0aGlzLmFsbFRleHQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJyc7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiAnXicgKyAkLmZuLmRhdGFUYWJsZS51dGlsLmVzY2FwZVJlZ2V4KHZhbHVlKSArICckJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgdGhpcykuam9pbignfCcpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBGaWx0ZXJzIHRoZSBvcHRpb25zIGJlZm9yZSBhZGRpbmcgdGhlbSB0byB0aGUgc2VsZWN0LiBDYW4gYmUgb3ZlcnJpZGRlblxuICAgICAqIGZvciBzcGVjaWZpYyBmaWx0ZXJpbmdcbiAgICAgKlxuICAgICAqIEBwYXJhbSB2YWx1ZSB7U3RyaW5nfSBPcHRpb24gdmFsdWVcbiAgICAgKi9cbiAgICBmaWx0ZXJPcHRpb25zOiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlLnRyaW0oKSAhPSAnJztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU29ydCB0aGUgb3B0aW9ucyBiZWZvcmUgYWRkaW5nIHRoZW0gdG8gdGhlIHNlbGVjdC4gQ2FuIGJlIG92ZXJyaWRkZW4gZm9yXG4gICAgICogc3BlY2lmaWMgc29ydHNcbiAgICAgKi9cbiAgICBzb3J0T3B0aW9uczogZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgaWYgKGEgPiBiKSB7XG4gICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhIDwgYikge1xuICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIDA7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEByZXR1cm5zIHtBcnJheTxTdHJpbmc+fSBUaGUgYXJyYXkgb2Ygc2VsZWN0ZWQgdmFsdWVzXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZ2V0U2VsZWN0aW9uOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLiRkb20uZmluZCgnb3B0aW9uOnNlbGVjdGVkJykudG9BcnJheSgpLm1hcChmdW5jdGlvbihvcHRpb24pIHtcbiAgICAgICAgICAgIHJldHVybiBvcHRpb24udmFsdWU7XG4gICAgICAgIH0pO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHsqfEFycmF5fSBUaGUgYXJyYXkgb2Ygbm9uIHNlbGVjdGVkIHZhbHVlc1xuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2dldE5vdFNlbGVjdGVkOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuJGRvbS5maW5kKCc6bm90KG9wdGlvbjpzZWxlY3RlZCknKS50b0FycmF5KCkubWFwKGZ1bmN0aW9uKG9wdGlvbikge1xuICAgICAgICAgICAgcmV0dXJuIG9wdGlvbi52YWx1ZTtcbiAgICAgICAgfSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEZvciBlYWNoIGVsZW1lbnQgaW4gdGhlIGRhdGEgb2JqZWN0LCBjcmVhdGVzIGFuIG9wdGlvbiBlbGVtZW50IHVzaW5nIHRoZSBmdW5jdGlvblxuICAgICAqIGZuQ3JlYXRlXG4gICAgICpcbiAgICAgKiBAcGFyYW0gZGF0YSB7alF1ZXJ5fSBUaGUgZGF0YSB0byBhZGQgdG8gdGhlIHNlbGVjdFxuICAgICAqIEBwYXJhbSBmbkNyZWF0ZSB7RnVuY3Rpb259IFRoZSBmdW5jdGlvbiB0byB1c2UgdG8gY3JlYXRlIHRoZSBvcHRpb25zXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfYWRkT3B0aW9uczogZnVuY3Rpb24gKGRhdGEsIGZuQ3JlYXRlKSB7XG4gICAgICAgIHRoaXMuJGRvbS5lbXB0eSgpO1xuXG4gICAgICAgIGlmICh0aGlzLmFsbFRleHQpXG4gICAgICAgICAgICBmbkNyZWF0ZS5jYWxsKHRoaXMsIHRoaXMuYWxsVGV4dCk7XG5cbiAgICAgICAgZGF0YS50b0FycmF5KCkuZmlsdGVyKHRoaXMuZmlsdGVyT3B0aW9ucykuc29ydCh0aGlzLnNvcnRPcHRpb25zKS5mb3JFYWNoKGZuQ3JlYXRlLCB0aGlzKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIHNlbGVjdGVkIG9wdGlvblxuICAgICAqXG4gICAgICogQHBhcmFtIHZhbHVlIHtTdHJpbmd9IFRoZSBvcHRpb24gdmFsdWVcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9hZGRTZWxlY3RlZE9wdGlvbjogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuJGRvbS5hcHBlbmQoJCgnPG9wdGlvbi8+JylcbiAgICAgICAgICAgIC52YWwodmFsdWUpXG4gICAgICAgICAgICAudGV4dCh2YWx1ZSlcbiAgICAgICAgICAgIC5hdHRyKCdzZWxlY3RlZCcsICdzZWxlY3RlZCcpXG4gICAgICAgICk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYW4gb3B0aW9uIHdpdGggdGhlIHNlbGVjdGVkIGZsYWcgYmFzZWQgb24gdGhlXG4gICAgICogY3VycmVudCBmaWx0ZXIgc3RhdGVcbiAgICAgKlxuICAgICAqIEBwYXJhbSB2YWx1ZSB7U3RyaW5nfSBUaGUgb3B0aW9uIHZhbHVlXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcmVmcmVzaE9wdGlvbjogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIHZhciAkb3B0aW9uID0gJCgnPG9wdGlvbi8+JylcbiAgICAgICAgICAgIC52YWwodmFsdWUpXG4gICAgICAgICAgICAudGV4dCh2YWx1ZSk7XG5cbiAgICAgICAgaWYgKCQuaW5BcnJheSh2YWx1ZSwgdGhpcy5zZWxlY3RlZCkgPiAtMSlcbiAgICAgICAgICAgICRvcHRpb24uYXR0cignc2VsZWN0ZWQnLCAnc2VsZWN0ZWQnKTtcblxuICAgICAgICB0aGlzLiRkb20uYXBwZW5kKCRvcHRpb24pO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBUYWtlcyBhIHNuYXBzaG90IG9mIHRoZSBjdXJyZW50IHNlbGVjdGlvbiBzdGF0ZVxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc2F2ZVNlbGVjdGlvbjogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuc2VsZWN0ZWQgPSB0aGlzLl9nZXRTZWxlY3Rpb24oKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogV2hlbmV2ZXIgdGhlIHNlbGVjdCBzdGF0ZSBjaGFuZ2VzLCBzYXZlIGl0cyBuZXcgc3RhdGUgYW5kXG4gICAgICogbm90aWZ5IHRoZSBsaXN0ZW5pbmcgY29tcG9uZW50XG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbkNoYW5nZTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuX3NhdmVTZWxlY3Rpb24oKTtcbiAgICAgICAgdGhpcy5ub3RpZnlDaGFuZ2UoKTtcbiAgICB9XG59KTtcblxudmFyIGJ1aWxkZXIgPSBmdW5jdGlvbihzZXR0aW5ncykge1xuICAgIHZhciByZW5kZXJlciA9IFNpbXBsZVJlbmRlcmVyO1xuXG4gICAgaWYgKHNldHRpbmdzLnJlbmRlcmVyID09ICdib290c3RyYXAnKVxuICAgICAgICByZW5kZXJlciA9IEJvb3RzdHJhcFJlbmRlcmVyO1xuXG4gICAgcmV0dXJuICQuZXh0ZW5kKHt9LCB0aGlzLCByZW5kZXJlciwgc2V0dGluZ3MpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgU2VsZWN0RmlsdGVyOiBTZWxlY3RGaWx0ZXIsXG4gICAgYnVpbGRlcjogYnVpbGRlclxufTsiLCIndXNlIHN0cmljdCc7XG5cbnZhciAkID0gKHdpbmRvdy4kKTtcbnZhciBGaWx0ZXJzID0gcmVxdWlyZSgnLi4vZmlsdGVycycpO1xudmFyIEJhc2VTZWxlY3QgPSByZXF1aXJlKCcuL2Jhc2VzZWxlY3QnKTtcblxudmFyIEZpeGVkU2VsZWN0RmlsdGVyID0gJC5leHRlbmQoe30sIEJhc2VTZWxlY3QuU2VsZWN0RmlsdGVyLCB7XG5cbiAgICAvKipcbiAgICAgKiBTaW1wbHkgc2F2ZXMgYSBoYW5kbGUgb24gdGhlIHByb3ZpZGVkIHNvdXJjZSBzZWxlY3RcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtGaXhlZFNlbGVjdEZpbHRlcn1cbiAgICAgKi9cbiAgICBpbml0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuJGRvbSA9ICQodGhpcy5zcmMpO1xuICAgICAgICB0aGlzLiRkb20ub24oJ2NoYW5nZScsIHRoaXMubm90aWZ5Q2hhbmdlLmJpbmQodGhpcykpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBObyBhY3Rpb24gZm9yIGZpeGVkIGZpbHRlcnM6IHRoZSBwcm92aWRlZCBzZWxlY3QgaXMgdXNlZCBhcyBpc1xuICAgICAqXG4gICAgICogQHJldHVybnMge0ZpeGVkU2VsZWN0RmlsdGVyfVxuICAgICAqL1xuICAgIHBvcHVsYXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBObyB1cGRhdGUgZm9yIGZpeGVkIGZpbHRlcnM6IHRoZSBwcm92aWRlZCBzZWxlY3QgaXMgbmV2ZXIgY2hhbmdlZFxuICAgICAqXG4gICAgICogQHJldHVybnMge0ZpeGVkU2VsZWN0RmlsdGVyfVxuICAgICAqL1xuICAgIHVwZGF0ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogRml4ZWQgZmlsdGVycyBjYW4gYmUgdXNlZCB0byBwcm92aWRlIGluaXRpYWwgZmlsdGVycyB0byBhcHBseSB0byB0aGVcbiAgICAgKiBkYXRhdGFibGUuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7KnxTdHJpbmd9XG4gICAgICovXG4gICAgZ2V0SW5pdGlhbFF1ZXJ5OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0UXVlcnkoKTtcbiAgICB9XG59KTtcblxuRmlsdGVycy5wcm90b3R5cGUuYnVpbGRlcnMuZml4ZWRzZWxlY3QgPSBCYXNlU2VsZWN0LmJ1aWxkZXIuYmluZChGaXhlZFNlbGVjdEZpbHRlcik7XG5cbm1vZHVsZS5leHBvcnRzID0gRml4ZWRTZWxlY3RGaWx0ZXI7IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgJCA9ICh3aW5kb3cuJCk7XG52YXIgRmlsdGVycyA9IHJlcXVpcmUoJy4uL2ZpbHRlcnMnKTtcbnZhciBCYXNlU2VsZWN0ID0gcmVxdWlyZSgnLi9iYXNlc2VsZWN0Jyk7XG5cbnZhciBNdWx0aVNlbGVjdEZpbHRlciA9ICQuZXh0ZW5kKHt9LCBCYXNlU2VsZWN0LlNlbGVjdEZpbHRlciwge1xuXG4gICAgLyoqXG4gICAgICogSW5pdGlhbGl6ZXMgYSBtdWx0aXNlbGVjdCBkb20gb2JqZWN0XG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7TXVsdGlTZWxlY3RGaWx0ZXJ9XG4gICAgICovXG4gICAgaW5pdDogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLiRkb20gPSAkKCc8c2VsZWN0IGNsYXNzPVwiZmlsdHJlXCIvPicpLmF0dHIoJ211bHRpcGxlJywgJ211bHRpcGxlJyk7XG4gICAgICAgIHRoaXMuJGRvbS5vbignY2hhbmdlJywgdGhpcy5fb25DaGFuZ2UuYmluZCh0aGlzKSk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFBvcHVsYXRlcyB0aGUgbXVsdGlzZWxlY3Qgd2l0aCAnc2VsZWN0ZWQnIG9wdGlvbnMgYnkgZGVmYXVsdFxuICAgICAqXG4gICAgICogQHBhcmFtIGRhdGFcbiAgICAgKiBAcmV0dXJucyB7TXVsdGlTZWxlY3RGaWx0ZXJ9XG4gICAgICovXG4gICAgcG9wdWxhdGU6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgIHRoaXMuX2FkZE9wdGlvbnMoZGF0YSwgdGhpcy5fYWRkU2VsZWN0ZWRPcHRpb24pO1xuICAgICAgICB0aGlzLl9vbkNoYW5nZSgpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBJZiB0aGUgJ2FsbCcgb3B0aW9uIGlzIHNlbGVjdGVkLCBzZXRzIHRoZSBuZXcgb3B0aW9ucyBhcyAnc2VsZWN0ZWQnLlxuICAgICAqIE90aGVyd2lzZSwgYWRkcyB0aGUgb3B0aW9ucyBiYXNlZCBvbiB0aGUgZmlsdGVyIHN0YXRlXG4gICAgICpcbiAgICAgKiBAcGFyYW0gZGF0YVxuICAgICAqIEByZXR1cm5zIHtNdWx0aVNlbGVjdEZpbHRlcn1cbiAgICAgKi9cbiAgICB1cGRhdGU6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgIGlmICgkLmluQXJyYXkodGhpcy5hbGxUZXh0LCB0aGlzLnNlbGVjdGVkKSA+IC0xIHx8IHRoaXMuX2dldE5vdFNlbGVjdGVkKCkubGVuZ3RoID09IDApXG4gICAgICAgICAgICB0aGlzLl9hZGRPcHRpb25zKGRhdGEsIHRoaXMuX2FkZFNlbGVjdGVkT3B0aW9uKTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgICAgdGhpcy5fYWRkT3B0aW9ucyhkYXRhLCB0aGlzLl9yZWZyZXNoT3B0aW9uKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogVGhpcyBmaWx0ZXIgaXMgZHluYW1pYywgaXQgY2FuJ3QgYmUgdXNlZCBmb3IgaW5pdGlhbCBmaWx0ZXJpbmdcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9XG4gICAgICovXG4gICAgZ2V0SW5pdGlhbFF1ZXJ5OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuICcnO1xuICAgIH1cbn0pO1xuXG5GaWx0ZXJzLnByb3RvdHlwZS5idWlsZGVycy5tdWx0aXNlbGVjdCA9IEJhc2VTZWxlY3QuYnVpbGRlci5iaW5kKE11bHRpU2VsZWN0RmlsdGVyKTtcblxubW9kdWxlLmV4cG9ydHMgPSBNdWx0aVNlbGVjdEZpbHRlcjsiLCIndXNlIHN0cmljdCc7XG5cbnZhciBCb290c3RyYXBSZW5kZXJlciA9IHtcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgkY29udGFpbmVyLCBoZWFkZXIsIGRhdGEpIHtcbiAgICAgICAgdGhpcy5wb3B1bGF0ZShkYXRhKTtcbiAgICAgICAgdGhpcy5zaG93RmlsdGVyKHRoaXMuJGRvbSwgJGNvbnRhaW5lciwgaGVhZGVyLCBkYXRhKTtcblxuICAgICAgICB2YXIgZGVmYXVsdE9wdGlvbnMgPSB7XG4gICAgICAgICAgICBidXR0b25UZXh0OiBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICAgICAgICAgIHZhciBuYlNlbGVjdGVkID0gJChvcHRpb25zKS5maWx0ZXIoJzpzZWxlY3RlZCcpLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBpZihuYlNlbGVjdGVkID09PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBoZWFkZXI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBoZWFkZXIgKyAnICgnICsgbmJTZWxlY3RlZCArICcpJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLiRkb20ubXVsdGlzZWxlY3QoJC5leHRlbmQoZGVmYXVsdE9wdGlvbnMsIHRoaXMucmVuZGVyZXJPcHRpb25zKSk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIHNob3dGaWx0ZXI6IGZ1bmN0aW9uKCRkb20sICRjb250YWluZXIsIGhlYWRlciwgZGF0YSkge1xuICAgICAgICAkY29udGFpbmVyLmFwcGVuZCh0aGlzLiRkb20pO1xuICAgIH0sXG5cbiAgICByZWZyZXNoOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICB0aGlzLnVwZGF0ZShkYXRhKTtcbiAgICAgICAgdGhpcy4kZG9tLm11bHRpc2VsZWN0KCdyZWJ1aWxkJyk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBCb290c3RyYXBSZW5kZXJlcjsiLCIndXNlIHN0cmljdCc7XG5cbnZhciAkID0gKHdpbmRvdy4kKTtcbnZhciBGaWx0ZXJzID0gcmVxdWlyZSgnLi4vZmlsdGVycycpO1xudmFyIEJhc2VTZWxlY3QgPSByZXF1aXJlKCcuL2Jhc2VzZWxlY3QnKTtcblxudmFyIFNpbXBsZVNlbGVjdEZpbHRlciA9ICQuZXh0ZW5kKHt9LCBCYXNlU2VsZWN0LlNlbGVjdEZpbHRlciwge1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIHNpbXBsZSBzZWxlY3RcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtTaW1wbGVTZWxlY3RGaWx0ZXJ9XG4gICAgICovXG4gICAgaW5pdDogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLiRkb20gPSAkKCc8c2VsZWN0IGNsYXNzPVwiZmlsdHJlXCIvPicpO1xuICAgICAgICB0aGlzLiRkb20ub24oJ2NoYW5nZScsIHRoaXMuX29uQ2hhbmdlLmJpbmQodGhpcykpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGFsbCBvcHRpb25zIHdpdGhvdXQgc3BlY2lmeWluZyB0aGUgJ3NlbGVjdGVkJyBmbGFnXG4gICAgICogKHRoZSBmaXJzdCBvcHRpb24gaXMgc2VsZWN0ZWQgYnkgZGVmYXVsdClcbiAgICAgKlxuICAgICAqIEBwYXJhbSBkYXRhXG4gICAgICogQHJldHVybnMge1NpbXBsZVNlbGVjdEZpbHRlcn1cbiAgICAgKi9cbiAgICBwb3B1bGF0ZTogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgdGhpcy5fYWRkT3B0aW9ucyhkYXRhLCB0aGlzLl9yZWZyZXNoT3B0aW9uKTtcbiAgICAgICAgdGhpcy5fb25DaGFuZ2UoKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmVmcmVzaCB0aGUgb3B0aW9ucyBiYXNlZCBvbiB0aGUgZmlsdGVyIHN0YXRlXG4gICAgICpcbiAgICAgKiBAcGFyYW0gZGF0YVxuICAgICAqIEByZXR1cm5zIHtTaW1wbGVTZWxlY3RGaWx0ZXJ9XG4gICAgICovXG4gICAgdXBkYXRlOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICB0aGlzLl9hZGRPcHRpb25zKGRhdGEsIHRoaXMuX3JlZnJlc2hPcHRpb24pO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBUaGlzIGZpbHRlciBpcyBkeW5hbWljLCBpdCBjYW4ndCBiZSB1c2VkIGZvciBpbml0aWFsIGZpbHRlcmluZ1xuICAgICAqXG4gICAgICogQHJldHVybnMge3N0cmluZ31cbiAgICAgKi9cbiAgICBnZXRJbml0aWFsUXVlcnk6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gJyc7XG4gICAgfVxufSk7XG5cbkZpbHRlcnMucHJvdG90eXBlLmJ1aWxkZXJzLnNlbGVjdCA9IEJhc2VTZWxlY3QuYnVpbGRlci5iaW5kKFNpbXBsZVNlbGVjdEZpbHRlcik7XG5cbm1vZHVsZS5leHBvcnRzID0gU2ltcGxlU2VsZWN0RmlsdGVyOyJdfQ==
