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
        return '$.^';
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
            if (value == this.allText  || this._getNotSelected().length === 0) {
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
var $ = (window.$);

var BootstrapRenderer = {
    render: function ($container, header, data) {
        this.populate(data);
        this.showFilter(this.$dom, $container, header, data);

        var defaultOptions = {
            buttonText: function (options) {
                var nbSelected = $(options).filter(':selected').length;
                if(nbSelected == 0) {
                    return header;
                }
                return header + ' (' + nbSelected + ')';
            }
        };

        this.$dom.multiselect($.extend(defaultOptions, this.rendererOptions));

        return this;
    },

    selectedQuery: function () {
        var $widget = this.$dom.multiselect();

        if ($.inArray($widget.selectAllText, $widget.val())) {
            return '';
        } else {
            return this._getSelection().map(function (value) {
                if (value == this.allText) {
                    return '';
                } else {
                    return '^' + $.fn.dataTable.util.escapeRegex(value) + '$';
                }
            }, this).join('|');
        }
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3Vzci9sb2NhbC9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXItcGFjay9fcHJlbHVkZS5qcyIsImpzL2Jhc2VmaWx0ZXIuanMiLCJqcy9maWx0ZXJzLmpzIiwianMvaW5wdXQvaW5wdXQuanMiLCJqcy9tYWluLmpzIiwianMvcmVuZGVyZXIvc2ltcGxlLmpzIiwianMvc2VsZWN0L2Jhc2VzZWxlY3QuanMiLCJqcy9zZWxlY3QvZml4ZWRzZWxlY3QuanMiLCJqcy9zZWxlY3QvbXVsdGlzZWxlY3QuanMiLCJqcy9zZWxlY3QvcmVuZGVyZXIvYm9vdHN0cmFwLmpzIiwianMvc2VsZWN0L3NpbXBsZXNlbGVjdC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25RQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcblxudmFyICQgPSAod2luZG93LiQpO1xuXG4vKipcbiAqIEJhc2VGaWx0ZXJcbiAqL1xudmFyIEJhc2VGaWx0ZXIgPSB7XG5cbiAgICAvKipcbiAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gV2hldGhlciBhIGZpbHRlciBjaGFuZ2UgbXVzdCB0cmlnZ2VyIGEgZGF0YXRhYmxlIHJlbG9hZC5cbiAgICAgKiBEZWZhdWx0IGlzIGZhbHNlIChjbGllbnQgc2lkZSBmaWx0ZXIpLlxuICAgICAqL1xuICAgIGlzU2VydmVyU2lkZTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSByZXF1ZXN0IHBhcmFtZXRlciBhc3NvY2lhdGVkIHdpdGggdGhpcyBmaWx0ZXIgKGluIHRoZSBmb3JtIGtleT1wYXJhbSxcbiAgICAgKiBvbmx5IHVzZWQgZm9yIHNlcnZlciBzaWRlIGZpbHRlcnMpXG4gICAgICovXG4gICAgZ2V0U2VydmVyUXVlcnk6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuICcnO1xuICAgIH0sXG5cbiAgICBub3RpZnlDaGFuZ2U6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy4kZG9tLnRyaWdnZXIoJ3VwZGF0ZS5maWx0ZXJzLmR0Jywge1xuICAgICAgICAgICAgZmlsdGVyOiB0aGlzXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgZmlsdGVyIHN0cmluZyB0byBiZSBhcHBsaWVkIHRvIHRoZSBkYXRhdGFibGUgY29sdW1uXG4gICAgICovXG4gICAgZ2V0UXVlcnk6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKCF0aGlzLmhhc1ZhbHVlKCkpXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5ub1NlbGVjdGlvblF1ZXJ5KCk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuc2VsZWN0ZWRRdWVyeSgpO1xuICAgIH0sXG5cbiAgICByZWdpc3RlcjogZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICAgICAgdGhpcy4kZG9tLm9uKCd1cGRhdGUuZmlsdGVycy5kdCcsIGNhbGxiYWNrKTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEJhc2VGaWx0ZXI7IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgJCA9ICh3aW5kb3cuJCk7XG5cbi8qKlxuICogRmlsdGVycyBpcyBhIGNvbXBvbmVudCB0aGF0IG1hbmFnZXMgYSBsaXN0IG9mIGZpbHRlcnMgb2JqZWN0IGluc2lkZVxuICogYSBkYXRhdGFibGUgaGVhZGVyIHJvdy5cbiAqXG4gKiBUaGlzIGNvbnN0cnVjdG9yIGJpbmRzIGxpc3RlbmVycyB0byB2YXJpb3VzIGRhdGF0YWJsZSBldmVudHMuXG4gKlxuICogQHBhcmFtIHNldHRpbmdzIHtPYmplY3R9IHNldHRpbmdzIG9iamVjdCB1c2VkIHRvIGNyZWF0ZSB0aGUgZGF0YXRhYmxlXG4gKi9cbnZhciBGaWx0ZXJzID0gZnVuY3Rpb24gKHNldHRpbmdzKSB7XG4gICAgdGhpcy50YWJsZUFQSSA9IG5ldyAkLmZuLmRhdGFUYWJsZS5BcGkoc2V0dGluZ3MpO1xuICAgIHRoaXMuJGhlYWRlciA9ICQodGhpcy50YWJsZUFQSS50YWJsZSgpLmhlYWRlcigpKTtcbiAgICB0aGlzLnVybCA9IHRoaXMudGFibGVBUEkuYWpheC51cmwoKTtcblxuICAgIHZhciBmaWx0ZXJzID0gW107XG4gICAgdmFyIGJ1aWxkZXJzID0gdGhpcy5idWlsZGVycztcbiAgICAkLmVhY2goc2V0dGluZ3MuYW9Db2x1bW5zLCBmdW5jdGlvbiAoY29sLCBwYXJhbSkge1xuICAgICAgICBpZiAocGFyYW0uZmlsdGVyKSB7XG4gICAgICAgICAgICB2YXIgb3B0aW9ucyA9ICQuZXh0ZW5kKHtjb2x1bW46IGNvbH0sIHBhcmFtLmZpbHRlcik7XG4gICAgICAgICAgICBmaWx0ZXJzLnB1c2goYnVpbGRlcnNbcGFyYW0uZmlsdGVyLnR5cGVdKG9wdGlvbnMpKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgaWYgKGZpbHRlcnMubGVuZ3RoID4gMCkge1xuICAgICAgICB0aGlzLmZpbHRlcnMgPSBmaWx0ZXJzO1xuICAgICAgICB0aGlzLmZpbHRlcnMuZm9yRWFjaChmdW5jdGlvbiAoZmlsdGVyKSB7XG4gICAgICAgICAgICBmaWx0ZXIuaW5pdCgpO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5maWx0ZXJzLmZvckVhY2godGhpcy5hcHBseUluaXRpYWxGaWx0ZXIsIHRoaXMpO1xuICAgICAgICB0aGlzLnRhYmxlQVBJLm9uKCdpbml0JywgdGhpcy5vbkRhdGFUYWJsZUluaXQuYmluZCh0aGlzKSk7XG4gICAgfVxufTtcblxuJC5leHRlbmQoRmlsdGVycy5wcm90b3R5cGUsIHtcblxuICAgIC8qKlxuICAgICAqIEFycmF5IG9mIGZpbHRlciBjb25zdHJ1Y3RvciBmdW5jdGlvbi4gRWFjaCBmdW5jdGlvblxuICAgICAqIHRha2VzIGEgc2V0dGluZyBvYmplY3QgYXMgaXRzIHNpbmdsZSBwYXJhbWV0ZXJcbiAgICAgKi9cbiAgICBidWlsZGVyczoge30sXG5cbiAgICAvKipcbiAgICAgKiBUYWJsZSBoZWFkZXIgZG9tIG5vZGVcbiAgICAgKiBAdHlwZSB7alF1ZXJ5fVxuICAgICAqL1xuICAgICRoZWFkZXI6IG51bGwsXG5cbiAgICAvKipcbiAgICAgKiBGaWx0ZXJzIGFycmF5XG4gICAgICogQHR5cGUge0FycmF5fVxuICAgICAqL1xuICAgIGZpbHRlcnM6IFtdLFxuXG4gICAgLyoqXG4gICAgICogVGFibGUgaW5pdGlhbCBhamF4IFVSTFxuICAgICAqIEB0eXBlIHtTdHJpbmd9XG4gICAgICovXG4gICAgdXJsOiAnJyxcblxuICAgIC8qKlxuICAgICAqIFJlZnJlc2hlcyBmaWx0ZXJzIGFmdGVyIGVhY2ggYWpheCByZXF1ZXN0XG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7RmlsdGVyc31cbiAgICAgKi9cbiAgICByZWdpc3RlckFqYXhMaXN0ZW5lcjogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnRhYmxlQVBJLm9uKCd4aHInLCAkLnByb3h5KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRoaXMudGFibGVBUEkub25lKCdwcmVEcmF3JywgJC5wcm94eSh0aGlzLnJlZnJlc2hGaWx0ZXJzLCB0aGlzKSk7XG4gICAgICAgIH0sIHRoaXMpKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogSW5pdGlhbGl6ZXMgdGhlIGhlYWRlciBIVE1MIGVsZW1lbnRzIHRoYXQgd2lsbCBiZSB1c2VkIHRvIGhvbGQgdGhlIGZpbHRlcnMuXG4gICAgICogSXQgYWxzbyByZWdpc3RlcnMgdGhlIG1haW4gZXZlbnQgaGFuZGxlciB0aGF0IHdpbGwgcmVhY3QgdG8gdGhlIGZpbHRlcnMnXG4gICAgICogdmFsdWUgY2hhbmdlcy5cbiAgICAgKlxuICAgICAqIFRoZSBldmVudCBuYW1lIGlzIDxiPmZpbHRlckNoYW5nZTwvYj4uIFRoaXMgZXZlbnQgbXVzdCBiZSB0cmlnZ2VyZWQgYnkgdGhlXG4gICAgICogZmlsdGVycyB3aGVuIHRoZWlyIHZhbHVlIGlzIG1vZGlmaWVkIGJ5IHRoZSB1c2VyIChvciBhbnkgb3RoZXIgZXZlbnQgdGhhdFxuICAgICAqIHNob3VsZCB0cmlnZ2VyIGEgZGF0YXRhYmxlIGZpbHRlcikuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7RmlsdGVyc31cbiAgICAgKi9cbiAgICBzZXR1cEhlYWRlclJvdzogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgJGZpbHRlckhlYWRlciA9ICQoJzx0ciBjbGFzcz1cImZpbHRlcnNcIj48L3RyPicpO1xuXG4gICAgICAgIHRoaXMudGFibGVBUEkuY29sdW1ucygnOnZpc2libGUnKS5oZWFkZXIoKS5lYWNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICRmaWx0ZXJIZWFkZXIuYXBwZW5kKCc8dGggY2xhc3M9XCJmb25kLWhlYWRlclwiPjwvdGg+Jyk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuJGhlYWRlci5hcHBlbmQoJGZpbHRlckhlYWRlcik7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJlZHJhd3MgdGhlIGRhdGF0YWJsZVxuICAgICAqXG4gICAgICogQHJldHVybnMge0ZpbHRlcnN9XG4gICAgICovXG4gICAgZHJhd1RhYmxlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMudGFibGVBUEkuZHJhdygpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZXMgdGhlIGNvbHVtbiBkYXRhIChjdXJyZW50IGZpbHRlciBpcyBpZ25vcmVkKVxuICAgICAqXG4gICAgICogQHBhcmFtIGNvbCB7aW50fSBUaGUgY29sdW1uIGluZGV4ICgwIGJhc2VkKVxuICAgICAqXG4gICAgICogQHJldHVybiB7alF1ZXJ5fSBUaGUgdW5maWx0ZXJlZCBjb2x1bW4gZGF0YVxuICAgICAqL1xuICAgIGdldENvbHVtbkRhdGE6IGZ1bmN0aW9uIChjb2wpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudGFibGVBUEkuY29sdW1uKGNvbCkuZGF0YSgpLnVuaXF1ZSgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXRyaWV2ZXMgdGhlIGNvbHVtbiBmaWx0ZXJlZCBkYXRhXG4gICAgICpcbiAgICAgKiBAcGFyYW0gY29sIHtpbnR9IFRoZSBjb2x1bW4gaW5kZXggKDAgYmFzZWQpXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtqUXVlcnl9IFRoZSBmaWx0ZXJlZCBjb2x1bW4gZGF0YVxuICAgICAqL1xuICAgIGdldEZpbHRlcmVkQ29sdW1uRGF0YTogZnVuY3Rpb24gKGNvbCkge1xuICAgICAgICByZXR1cm4gdGhpcy50YWJsZUFQSS5jb2x1bW4oY29sLCB7c2VhcmNoOiAnYXBwbGllZCd9KS5kYXRhKCkudW5pcXVlKCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEFjdGlvbnMgdG8gZXhlY3V0ZSB3aGVuIHRoZSBkYXRhdGFibGUgaXMgZG9uZSBpbml0aWFsaXppbmcuXG4gICAgICogQ3JlYXRlcyB0aGUgZmlsdGVyIGhlYWRlciByb3csIHJlZ2lzdGVycyBhamF4IGxpc3RlbmVycyBhbmRcbiAgICAgKiByZW5kZXJzIGZpbHRlcnNcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJzfVxuICAgICAqL1xuICAgIG9uRGF0YVRhYmxlSW5pdDogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnNldHVwSGVhZGVyUm93KCkucmVnaXN0ZXJBamF4TGlzdGVuZXIoKS5yZW5kZXJGaWx0ZXJzKCk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFdoZW4gYSBjbGllbnQtc2lkZSBmaWx0ZXIgY2hhbmdlcywgYXBwbGllcyBpdHMgbmV3IHZhbHVlXG4gICAgICpcbiAgICAgKiBAcGFyYW0gZXZlbnQge0V2ZW50fSBldmVudCBvYmplY3RcbiAgICAgKiBAcGFyYW0gcGFyYW1zIHtPYmplY3R9IGV2ZW50IHBhcmFtc1xuICAgICAqXG4gICAgICogQHJldHVybiB7RmlsdGVyc31cbiAgICAgKi9cbiAgICBvbkNsaWVudEZpbHRlckNoYW5nZTogZnVuY3Rpb24gKGV2ZW50LCBwYXJhbXMpIHtcbiAgICAgICAgdGhpcy5hcHBseUZpbHRlcihwYXJhbXMuZmlsdGVyKS5kcmF3VGFibGUoKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogV2hlbiBhIHNlcnZlci1zaWRlIGZpbHRlciBjaGFuZ2VzLCBidWlsZHMgdGhlIG5ldyBhamF4IHF1ZXJ5IGFuZCByZWZyZXNoZXMgdGhlIHRhYmxlXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtGaWx0ZXJzfVxuICAgICAqL1xuICAgIG9uU2VydmVyRmlsdGVyQ2hhbmdlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBzZXJ2ZXJRdWVyeSA9ICQuZ3JlcCh0aGlzLmZpbHRlcnMsIGZ1bmN0aW9uIChmaWx0ZXIpIHtcbiAgICAgICAgICAgIHJldHVybiBmaWx0ZXIuaXNTZXJ2ZXJTaWRlKCk7XG4gICAgICAgIH0pLm1hcChmdW5jdGlvbiAoZmlsdGVyKSB7XG4gICAgICAgICAgICByZXR1cm4gZmlsdGVyLmdldFNlcnZlclF1ZXJ5KCk7XG4gICAgICAgIH0pLmpvaW4oJyYnKTtcblxuICAgICAgICB0aGlzLnRhYmxlQVBJLmFqYXgudXJsKHRoaXMudXJsICsgJz8nICsgc2VydmVyUXVlcnkpLmFqYXgucmVsb2FkKCk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEFwcGxpZXMgdGhlIGZpbHRlciB2YWx1ZSB0byB0aGUgcmVsYXRlZCBjb2x1bW5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBmaWx0ZXIgVGhlIGZpbHRlciBvYmplY3RcbiAgICAgKlxuICAgICAqIEByZXR1cm4ge0ZpbHRlcnN9XG4gICAgICovXG4gICAgYXBwbHlGaWx0ZXI6IGZ1bmN0aW9uIChmaWx0ZXIpIHtcbiAgICAgICAgdGhpcy50YWJsZUFQSS5jb2x1bW4oZmlsdGVyLmNvbHVtbikuc2VhcmNoKFxuICAgICAgICAgICAgZmlsdGVyLmdldFF1ZXJ5KCksXG4gICAgICAgICAgICBmaWx0ZXIuaXNSZWdleE1hdGNoKClcbiAgICAgICAgICAgICwgZmFsc2UpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBFbmFibGVzIGZpbHRlcnMgdG8gYXBwbHkgYW4gaW5pdGlhbCBjb2x1bW4gZmlsdGVyLCBiZWZvcmVcbiAgICAgKiBhbnkgZGF0YSBwcm9jZXNzaW5nL2Rpc3BsYXlpbmcgaXMgZG9uZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBmaWx0ZXJcbiAgICAgKiBAcmV0dXJucyB7RmlsdGVyc31cbiAgICAgKi9cbiAgICBhcHBseUluaXRpYWxGaWx0ZXI6IGZ1bmN0aW9uIChmaWx0ZXIpIHtcbiAgICAgICAgdGhpcy50YWJsZUFQSS5jb2x1bW4oZmlsdGVyLmNvbHVtbikuc2VhcmNoKFxuICAgICAgICAgICAgZmlsdGVyLmdldEluaXRpYWxRdWVyeSgpLFxuICAgICAgICAgICAgZmlsdGVyLmlzUmVnZXhNYXRjaCgpXG4gICAgICAgICAgICAsIGZhbHNlKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHNlZSB0aGlzLnJlbmRlckZpbHRlclxuICAgICAqXG4gICAgICogQHJldHVybnMge0ZpbHRlcnN9XG4gICAgICovXG4gICAgcmVuZGVyRmlsdGVyczogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLmZpbHRlcnMuZm9yRWFjaCh0aGlzLnJlbmRlckZpbHRlciwgdGhpcyk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEFza3MgYSBmaWx0ZXIgdG8gcmVuZGVyIGl0c2VsZiBhbmQgcHJvdmlkZXMgYW4gb3B0aW9uYWwgY29udGFpbmVyXG4gICAgICogZm9yIGZpbHRlcnMgdGhhdCBuZWVkIHRvIGJlIHJlbmRlcmVkIGluc2lkZSB0aGUgZGF0YXRhYmxlIGhlYWRlciByb3dcbiAgICAgKlxuICAgICAqIEBwYXJhbSBmaWx0ZXIgVGhlIGZpbHRlciBvYmplY3RcbiAgICAgKi9cbiAgICByZW5kZXJGaWx0ZXI6IGZ1bmN0aW9uIChmaWx0ZXIpIHtcbiAgICAgICAgdmFyIGNvbCA9IGZpbHRlci5jb2x1bW47XG4gICAgICAgIHZhciAkY29sSGVhZGVyID0gJCh0aGlzLnRhYmxlQVBJLmNvbHVtbihjb2wpLmhlYWRlcigpKTtcbiAgICAgICAgdmFyICRjb250YWluZXIgPSB0aGlzLiRoZWFkZXIuZmluZCgnLmZvbmQtaGVhZGVyOmVxKCcgKyBjb2wgKyAnKScpO1xuXG4gICAgICAgIGlmIChmaWx0ZXIuaXNTZXJ2ZXJTaWRlKCkpIHtcbiAgICAgICAgICAgIGZpbHRlci5yZWdpc3RlcigkLnByb3h5KHRoaXMub25TZXJ2ZXJGaWx0ZXJDaGFuZ2UsIHRoaXMpKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZpbHRlci5yZWdpc3RlcigkLnByb3h5KHRoaXMub25DbGllbnRGaWx0ZXJDaGFuZ2UsIHRoaXMpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZpbHRlci5yZW5kZXIoJGNvbnRhaW5lciwgJGNvbEhlYWRlci5odG1sKCksIHRoaXMuZ2V0Q29sdW1uRGF0YShjb2wpKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmVmcmVzaGVzIHRoZSBmaWx0ZXJzIGJhc2VkIG9uIHRoZSBjdXJyZW50bHkgZGlzcGxheWVkIGRhdGEgZm9yIGVhY2ggY29sdW1uXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtGaWx0ZXJzfVxuICAgICAqL1xuICAgIHJlZnJlc2hGaWx0ZXJzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuZmlsdGVycy5mb3JFYWNoKGZ1bmN0aW9uIChmaWx0ZXIpIHtcbiAgICAgICAgICAgIGZpbHRlci5yZWZyZXNoKHRoaXMuZ2V0Q29sdW1uRGF0YShmaWx0ZXIuY29sdW1uKSk7XG4gICAgICAgICAgICB0aGlzLmFwcGx5RmlsdGVyKGZpbHRlcik7XG4gICAgICAgIH0sIHRoaXMpO1xuXG4gICAgICAgIHRoaXMuZHJhd1RhYmxlKCk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxufSk7XG5cbiQoZG9jdW1lbnQpLm9uKCdwcmVJbml0LmR0JywgZnVuY3Rpb24gKGUsIHNldHRpbmdzKSB7XG4gICAgbmV3IEZpbHRlcnMoc2V0dGluZ3MpO1xufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gRmlsdGVyczsiLCIndXNlIHN0cmljdCc7XG5cbnZhciAkID0gKHdpbmRvdy4kKTtcbnZhciBCYXNlRmlsdGVyID0gcmVxdWlyZSgnLi4vYmFzZWZpbHRlcicpO1xudmFyIFNpbXBsZVJlbmRlcmVyID0gcmVxdWlyZSgnLi4vcmVuZGVyZXIvc2ltcGxlJyk7XG52YXIgRmlsdGVycyA9IHJlcXVpcmUoJy4uL2ZpbHRlcnMnKTtcblxudmFyIElucHV0RmlsdGVyID0gJC5leHRlbmQoe30sIEJhc2VGaWx0ZXIsIFNpbXBsZVJlbmRlcmVyLCB7XG5cbiAgICBpbml0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuJGRvbSA9ICQoJzxpbnB1dCBjbGFzcz1cImZpbHRyZVwiLz4nKTtcbiAgICAgICAgdGhpcy4kZG9tLm9uKCdpbnB1dCcsIHRoaXMubm90aWZ5Q2hhbmdlLmJpbmQodGhpcykpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICBwb3B1bGF0ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgdXBkYXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICBub1NlbGVjdGlvblF1ZXJ5OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiAnJztcbiAgICB9LFxuXG4gICAgaXNSZWdleE1hdGNoOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH0sXG5cbiAgICBoYXNWYWx1ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy4kZG9tLnZhbCgpICE9ICcnO1xuICAgIH0sXG5cbiAgICBzZWxlY3RlZFF1ZXJ5OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLiRkb20udmFsKCk7XG4gICAgfSxcblxuICAgIGdldEluaXRpYWxRdWVyeTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gJyc7XG4gICAgfVxufSk7XG5cbkZpbHRlcnMucHJvdG90eXBlLmJ1aWxkZXJzLmlucHV0ID0gZnVuY3Rpb24oc2V0dGluZ3MpIHtcbiAgcmV0dXJuICQuZXh0ZW5kKHt9LCBJbnB1dEZpbHRlciwgc2V0dGluZ3MpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBJbnB1dEZpbHRlcjsiLCIndXNlIHN0cmljdCc7XG5cbnJlcXVpcmUoJy4vc2VsZWN0L3NpbXBsZXNlbGVjdCcpO1xucmVxdWlyZSgnLi9zZWxlY3QvbXVsdGlzZWxlY3QnKTtcbnJlcXVpcmUoJy4vc2VsZWN0L2ZpeGVkc2VsZWN0Jyk7XG5yZXF1aXJlKCcuL2lucHV0L2lucHV0Jyk7XG5yZXF1aXJlKCcuL2ZpbHRlcnMnKTsiLCIndXNlIHN0cmljdCc7XG5cbnZhciAkID0gKHdpbmRvdy4kKTtcblxudmFyIFNpbXBsZVJlbmRlcmVyID0ge1xuICAgIHJlbmRlcjogZnVuY3Rpb24gKCRjb250YWluZXIsIGhlYWRlciwgZGF0YSkge1xuICAgICAgICB0aGlzLnBvcHVsYXRlKGRhdGEpO1xuICAgICAgICB0aGlzLnNob3dGaWx0ZXIodGhpcy4kZG9tLCAkY29udGFpbmVyLCBoZWFkZXIsIGRhdGEpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICBzaG93RmlsdGVyOiBmdW5jdGlvbigkZG9tLCAkY29udGFpbmVyLCBoZWFkZXIsIGRhdGEpIHtcbiAgICAgICAgJGNvbnRhaW5lci5hcHBlbmQodGhpcy4kZG9tKTtcbiAgICAgICAgdGhpcy4kZG9tLmF0dHIoJ25hbWUnLCBoZWFkZXIpLmF0dHIoJ3BsYWNlaG9sZGVyJywgaGVhZGVyKS5zaG93KCk7XG4gICAgfSxcblxuICAgIHJlZnJlc2g6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgIHRoaXMudXBkYXRlKGRhdGEpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gU2ltcGxlUmVuZGVyZXI7IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgJCA9ICh3aW5kb3cuJCk7XG52YXIgQmFzZUZpbHRlciA9IHJlcXVpcmUoJy4uL2Jhc2VmaWx0ZXInKTtcbnZhciBTaW1wbGVSZW5kZXJlciA9IHJlcXVpcmUoJy4uL3JlbmRlcmVyL3NpbXBsZScpO1xudmFyIEJvb3RzdHJhcFJlbmRlcmVyID0gcmVxdWlyZSgnLi9yZW5kZXJlci9ib290c3RyYXAnKTtcblxuLyoqXG4gKiBTZWxlY3RGaWx0ZXIgcmVncm91cHMgY29tbW9uIGJlaGF2aW9yIGZvciBzZWxlY3QgZmlsdGVyc1xuICovXG52YXIgU2VsZWN0RmlsdGVyID0gJC5leHRlbmQoe30sIEJhc2VGaWx0ZXIsIHtcbiAgICBzZWxlY3RlZDogW10sXG5cbiAgICAvKipcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIGFuIGFsd2F5cyBmYWxzZSByZWdleCB0byBoaWRlIGV2ZXJ5IHJlY29yZHNcbiAgICAgKiB3aGVuIG5vIG9wdGlvbiBpcyBzZWxlY3RlZFxuICAgICAqL1xuICAgIG5vU2VsZWN0aW9uUXVlcnk6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuICckLl4nO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZS4gU2VsZWN0IGZpbHRlcnMgYWx3YXlzIHVzZSByZWdleFxuICAgICAqL1xuICAgIGlzUmVnZXhNYXRjaDogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgdHJ1ZSBpZiBhdCBsZWFzdCBvbmUgb3B0aW9uIGlzIHNlbGVjdGVkXG4gICAgICovXG4gICAgaGFzVmFsdWU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2dldFNlbGVjdGlvbigpLmxlbmd0aCA+IDA7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBjb2x1bW4gZmlsdGVyIHF1ZXJ5IHRvIGFwcGx5LiBTZWxlY3RlZCBvcHRpb24gdmFsdWVzXG4gICAgICogYXJlIGNvbmNhdGVuYXRlZCBpbnRvIGEgc3RyaW5nIHVzaW5nIHRoZSBwaXBlIGNoYXJhY3RlciAocmVnZXggb3IpXG4gICAgICovXG4gICAgc2VsZWN0ZWRRdWVyeTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZ2V0U2VsZWN0aW9uKCkubWFwKGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgICAgaWYgKHZhbHVlID09IHRoaXMuYWxsVGV4dCAgfHwgdGhpcy5fZ2V0Tm90U2VsZWN0ZWQoKS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJyc7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiAnXicgKyAkLmZuLmRhdGFUYWJsZS51dGlsLmVzY2FwZVJlZ2V4KHZhbHVlKSArICckJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgdGhpcykuam9pbignfCcpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBGaWx0ZXJzIHRoZSBvcHRpb25zIGJlZm9yZSBhZGRpbmcgdGhlbSB0byB0aGUgc2VsZWN0LiBDYW4gYmUgb3ZlcnJpZGRlblxuICAgICAqIGZvciBzcGVjaWZpYyBmaWx0ZXJpbmdcbiAgICAgKlxuICAgICAqIEBwYXJhbSB2YWx1ZSB7U3RyaW5nfSBPcHRpb24gdmFsdWVcbiAgICAgKi9cbiAgICBmaWx0ZXJPcHRpb25zOiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlLnRyaW0oKSAhPSAnJztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU29ydCB0aGUgb3B0aW9ucyBiZWZvcmUgYWRkaW5nIHRoZW0gdG8gdGhlIHNlbGVjdC4gQ2FuIGJlIG92ZXJyaWRkZW4gZm9yXG4gICAgICogc3BlY2lmaWMgc29ydHNcbiAgICAgKi9cbiAgICBzb3J0T3B0aW9uczogZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgICAgaWYgKGEgPiBiKSB7XG4gICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhIDwgYikge1xuICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIDA7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEByZXR1cm5zIHtBcnJheTxTdHJpbmc+fSBUaGUgYXJyYXkgb2Ygc2VsZWN0ZWQgdmFsdWVzXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZ2V0U2VsZWN0aW9uOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLiRkb20uZmluZCgnb3B0aW9uOnNlbGVjdGVkJykudG9BcnJheSgpLm1hcChmdW5jdGlvbihvcHRpb24pIHtcbiAgICAgICAgICAgIHJldHVybiBvcHRpb24udmFsdWU7XG4gICAgICAgIH0pO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHsqfEFycmF5fSBUaGUgYXJyYXkgb2Ygbm9uIHNlbGVjdGVkIHZhbHVlc1xuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2dldE5vdFNlbGVjdGVkOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuJGRvbS5maW5kKCc6bm90KG9wdGlvbjpzZWxlY3RlZCknKS50b0FycmF5KCkubWFwKGZ1bmN0aW9uKG9wdGlvbikge1xuICAgICAgICAgICAgcmV0dXJuIG9wdGlvbi52YWx1ZTtcbiAgICAgICAgfSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEZvciBlYWNoIGVsZW1lbnQgaW4gdGhlIGRhdGEgb2JqZWN0LCBjcmVhdGVzIGFuIG9wdGlvbiBlbGVtZW50IHVzaW5nIHRoZSBmdW5jdGlvblxuICAgICAqIGZuQ3JlYXRlXG4gICAgICpcbiAgICAgKiBAcGFyYW0gZGF0YSB7alF1ZXJ5fSBUaGUgZGF0YSB0byBhZGQgdG8gdGhlIHNlbGVjdFxuICAgICAqIEBwYXJhbSBmbkNyZWF0ZSB7RnVuY3Rpb259IFRoZSBmdW5jdGlvbiB0byB1c2UgdG8gY3JlYXRlIHRoZSBvcHRpb25zXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfYWRkT3B0aW9uczogZnVuY3Rpb24gKGRhdGEsIGZuQ3JlYXRlKSB7XG4gICAgICAgIHRoaXMuJGRvbS5lbXB0eSgpO1xuXG4gICAgICAgIGlmICh0aGlzLmFsbFRleHQpXG4gICAgICAgICAgICBmbkNyZWF0ZS5jYWxsKHRoaXMsIHRoaXMuYWxsVGV4dCk7XG5cbiAgICAgICAgZGF0YS50b0FycmF5KCkuZmlsdGVyKHRoaXMuZmlsdGVyT3B0aW9ucykuc29ydCh0aGlzLnNvcnRPcHRpb25zKS5mb3JFYWNoKGZuQ3JlYXRlLCB0aGlzKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIHNlbGVjdGVkIG9wdGlvblxuICAgICAqXG4gICAgICogQHBhcmFtIHZhbHVlIHtTdHJpbmd9IFRoZSBvcHRpb24gdmFsdWVcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9hZGRTZWxlY3RlZE9wdGlvbjogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuJGRvbS5hcHBlbmQoJCgnPG9wdGlvbi8+JylcbiAgICAgICAgICAgIC52YWwodmFsdWUpXG4gICAgICAgICAgICAudGV4dCh2YWx1ZSlcbiAgICAgICAgICAgIC5hdHRyKCdzZWxlY3RlZCcsICdzZWxlY3RlZCcpXG4gICAgICAgICk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYW4gb3B0aW9uIHdpdGggdGhlIHNlbGVjdGVkIGZsYWcgYmFzZWQgb24gdGhlXG4gICAgICogY3VycmVudCBmaWx0ZXIgc3RhdGVcbiAgICAgKlxuICAgICAqIEBwYXJhbSB2YWx1ZSB7U3RyaW5nfSBUaGUgb3B0aW9uIHZhbHVlXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcmVmcmVzaE9wdGlvbjogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIHZhciAkb3B0aW9uID0gJCgnPG9wdGlvbi8+JylcbiAgICAgICAgICAgIC52YWwodmFsdWUpXG4gICAgICAgICAgICAudGV4dCh2YWx1ZSk7XG5cbiAgICAgICAgaWYgKCQuaW5BcnJheSh2YWx1ZSwgdGhpcy5zZWxlY3RlZCkgPiAtMSlcbiAgICAgICAgICAgICRvcHRpb24uYXR0cignc2VsZWN0ZWQnLCAnc2VsZWN0ZWQnKTtcblxuICAgICAgICB0aGlzLiRkb20uYXBwZW5kKCRvcHRpb24pO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBUYWtlcyBhIHNuYXBzaG90IG9mIHRoZSBjdXJyZW50IHNlbGVjdGlvbiBzdGF0ZVxuICAgICAqXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfc2F2ZVNlbGVjdGlvbjogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuc2VsZWN0ZWQgPSB0aGlzLl9nZXRTZWxlY3Rpb24oKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogV2hlbmV2ZXIgdGhlIHNlbGVjdCBzdGF0ZSBjaGFuZ2VzLCBzYXZlIGl0cyBuZXcgc3RhdGUgYW5kXG4gICAgICogbm90aWZ5IHRoZSBsaXN0ZW5pbmcgY29tcG9uZW50XG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9vbkNoYW5nZTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuX3NhdmVTZWxlY3Rpb24oKTtcbiAgICAgICAgdGhpcy5ub3RpZnlDaGFuZ2UoKTtcbiAgICB9XG59KTtcblxudmFyIGJ1aWxkZXIgPSBmdW5jdGlvbihzZXR0aW5ncykge1xuICAgIHZhciByZW5kZXJlciA9IFNpbXBsZVJlbmRlcmVyO1xuXG4gICAgaWYgKHNldHRpbmdzLnJlbmRlcmVyID09ICdib290c3RyYXAnKVxuICAgICAgICByZW5kZXJlciA9IEJvb3RzdHJhcFJlbmRlcmVyO1xuXG4gICAgcmV0dXJuICQuZXh0ZW5kKHt9LCB0aGlzLCByZW5kZXJlciwgc2V0dGluZ3MpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgU2VsZWN0RmlsdGVyOiBTZWxlY3RGaWx0ZXIsXG4gICAgYnVpbGRlcjogYnVpbGRlclxufTsiLCIndXNlIHN0cmljdCc7XG5cbnZhciAkID0gKHdpbmRvdy4kKTtcbnZhciBGaWx0ZXJzID0gcmVxdWlyZSgnLi4vZmlsdGVycycpO1xudmFyIEJhc2VTZWxlY3QgPSByZXF1aXJlKCcuL2Jhc2VzZWxlY3QnKTtcblxudmFyIEZpeGVkU2VsZWN0RmlsdGVyID0gJC5leHRlbmQoe30sIEJhc2VTZWxlY3QuU2VsZWN0RmlsdGVyLCB7XG5cbiAgICAvKipcbiAgICAgKiBTaW1wbHkgc2F2ZXMgYSBoYW5kbGUgb24gdGhlIHByb3ZpZGVkIHNvdXJjZSBzZWxlY3RcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtGaXhlZFNlbGVjdEZpbHRlcn1cbiAgICAgKi9cbiAgICBpbml0OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuJGRvbSA9ICQodGhpcy5zcmMpO1xuICAgICAgICB0aGlzLiRkb20ub24oJ2NoYW5nZScsIHRoaXMubm90aWZ5Q2hhbmdlLmJpbmQodGhpcykpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBObyBhY3Rpb24gZm9yIGZpeGVkIGZpbHRlcnM6IHRoZSBwcm92aWRlZCBzZWxlY3QgaXMgdXNlZCBhcyBpc1xuICAgICAqXG4gICAgICogQHJldHVybnMge0ZpeGVkU2VsZWN0RmlsdGVyfVxuICAgICAqL1xuICAgIHBvcHVsYXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBObyB1cGRhdGUgZm9yIGZpeGVkIGZpbHRlcnM6IHRoZSBwcm92aWRlZCBzZWxlY3QgaXMgbmV2ZXIgY2hhbmdlZFxuICAgICAqXG4gICAgICogQHJldHVybnMge0ZpeGVkU2VsZWN0RmlsdGVyfVxuICAgICAqL1xuICAgIHVwZGF0ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogRml4ZWQgZmlsdGVycyBjYW4gYmUgdXNlZCB0byBwcm92aWRlIGluaXRpYWwgZmlsdGVycyB0byBhcHBseSB0byB0aGVcbiAgICAgKiBkYXRhdGFibGUuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7KnxTdHJpbmd9XG4gICAgICovXG4gICAgZ2V0SW5pdGlhbFF1ZXJ5OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0UXVlcnkoKTtcbiAgICB9XG59KTtcblxuRmlsdGVycy5wcm90b3R5cGUuYnVpbGRlcnMuZml4ZWRzZWxlY3QgPSBCYXNlU2VsZWN0LmJ1aWxkZXIuYmluZChGaXhlZFNlbGVjdEZpbHRlcik7XG5cbm1vZHVsZS5leHBvcnRzID0gRml4ZWRTZWxlY3RGaWx0ZXI7IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgJCA9ICh3aW5kb3cuJCk7XG52YXIgRmlsdGVycyA9IHJlcXVpcmUoJy4uL2ZpbHRlcnMnKTtcbnZhciBCYXNlU2VsZWN0ID0gcmVxdWlyZSgnLi9iYXNlc2VsZWN0Jyk7XG5cbnZhciBNdWx0aVNlbGVjdEZpbHRlciA9ICQuZXh0ZW5kKHt9LCBCYXNlU2VsZWN0LlNlbGVjdEZpbHRlciwge1xuXG4gICAgLyoqXG4gICAgICogSW5pdGlhbGl6ZXMgYSBtdWx0aXNlbGVjdCBkb20gb2JqZWN0XG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7TXVsdGlTZWxlY3RGaWx0ZXJ9XG4gICAgICovXG4gICAgaW5pdDogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLiRkb20gPSAkKCc8c2VsZWN0IGNsYXNzPVwiZmlsdHJlXCIvPicpLmF0dHIoJ211bHRpcGxlJywgJ211bHRpcGxlJyk7XG4gICAgICAgIHRoaXMuJGRvbS5vbignY2hhbmdlJywgdGhpcy5fb25DaGFuZ2UuYmluZCh0aGlzKSk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFBvcHVsYXRlcyB0aGUgbXVsdGlzZWxlY3Qgd2l0aCAnc2VsZWN0ZWQnIG9wdGlvbnMgYnkgZGVmYXVsdFxuICAgICAqXG4gICAgICogQHBhcmFtIGRhdGFcbiAgICAgKiBAcmV0dXJucyB7TXVsdGlTZWxlY3RGaWx0ZXJ9XG4gICAgICovXG4gICAgcG9wdWxhdGU6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgIHRoaXMuX2FkZE9wdGlvbnMoZGF0YSwgdGhpcy5fYWRkU2VsZWN0ZWRPcHRpb24pO1xuICAgICAgICB0aGlzLl9vbkNoYW5nZSgpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBJZiB0aGUgJ2FsbCcgb3B0aW9uIGlzIHNlbGVjdGVkLCBzZXRzIHRoZSBuZXcgb3B0aW9ucyBhcyAnc2VsZWN0ZWQnLlxuICAgICAqIE90aGVyd2lzZSwgYWRkcyB0aGUgb3B0aW9ucyBiYXNlZCBvbiB0aGUgZmlsdGVyIHN0YXRlXG4gICAgICpcbiAgICAgKiBAcGFyYW0gZGF0YVxuICAgICAqIEByZXR1cm5zIHtNdWx0aVNlbGVjdEZpbHRlcn1cbiAgICAgKi9cbiAgICB1cGRhdGU6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgIGlmICgkLmluQXJyYXkodGhpcy5hbGxUZXh0LCB0aGlzLnNlbGVjdGVkKSA+IC0xIHx8IHRoaXMuX2dldE5vdFNlbGVjdGVkKCkubGVuZ3RoID09IDApXG4gICAgICAgICAgICB0aGlzLl9hZGRPcHRpb25zKGRhdGEsIHRoaXMuX2FkZFNlbGVjdGVkT3B0aW9uKTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgICAgdGhpcy5fYWRkT3B0aW9ucyhkYXRhLCB0aGlzLl9yZWZyZXNoT3B0aW9uKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogVGhpcyBmaWx0ZXIgaXMgZHluYW1pYywgaXQgY2FuJ3QgYmUgdXNlZCBmb3IgaW5pdGlhbCBmaWx0ZXJpbmdcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9XG4gICAgICovXG4gICAgZ2V0SW5pdGlhbFF1ZXJ5OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuICcnO1xuICAgIH1cbn0pO1xuXG5GaWx0ZXJzLnByb3RvdHlwZS5idWlsZGVycy5tdWx0aXNlbGVjdCA9IEJhc2VTZWxlY3QuYnVpbGRlci5iaW5kKE11bHRpU2VsZWN0RmlsdGVyKTtcblxubW9kdWxlLmV4cG9ydHMgPSBNdWx0aVNlbGVjdEZpbHRlcjsiLCIndXNlIHN0cmljdCc7XG52YXIgJCA9ICh3aW5kb3cuJCk7XG5cbnZhciBCb290c3RyYXBSZW5kZXJlciA9IHtcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgkY29udGFpbmVyLCBoZWFkZXIsIGRhdGEpIHtcbiAgICAgICAgdGhpcy5wb3B1bGF0ZShkYXRhKTtcbiAgICAgICAgdGhpcy5zaG93RmlsdGVyKHRoaXMuJGRvbSwgJGNvbnRhaW5lciwgaGVhZGVyLCBkYXRhKTtcblxuICAgICAgICB2YXIgZGVmYXVsdE9wdGlvbnMgPSB7XG4gICAgICAgICAgICBidXR0b25UZXh0OiBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICAgICAgICAgIHZhciBuYlNlbGVjdGVkID0gJChvcHRpb25zKS5maWx0ZXIoJzpzZWxlY3RlZCcpLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBpZihuYlNlbGVjdGVkID09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGhlYWRlcjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIGhlYWRlciArICcgKCcgKyBuYlNlbGVjdGVkICsgJyknO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuJGRvbS5tdWx0aXNlbGVjdCgkLmV4dGVuZChkZWZhdWx0T3B0aW9ucywgdGhpcy5yZW5kZXJlck9wdGlvbnMpKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgc2VsZWN0ZWRRdWVyeTogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgJHdpZGdldCA9IHRoaXMuJGRvbS5tdWx0aXNlbGVjdCgpO1xuXG4gICAgICAgIGlmICgkLmluQXJyYXkoJHdpZGdldC5zZWxlY3RBbGxUZXh0LCAkd2lkZ2V0LnZhbCgpKSkge1xuICAgICAgICAgICAgcmV0dXJuICcnO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX2dldFNlbGVjdGlvbigpLm1hcChmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgICAgICBpZiAodmFsdWUgPT0gdGhpcy5hbGxUZXh0KSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAnJztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gJ14nICsgJC5mbi5kYXRhVGFibGUudXRpbC5lc2NhcGVSZWdleCh2YWx1ZSkgKyAnJCc7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSwgdGhpcykuam9pbignfCcpO1xuICAgICAgICB9XG4gICAgfSxcblxuICAgIHNob3dGaWx0ZXI6IGZ1bmN0aW9uKCRkb20sICRjb250YWluZXIsIGhlYWRlciwgZGF0YSkge1xuICAgICAgICAkY29udGFpbmVyLmFwcGVuZCh0aGlzLiRkb20pO1xuICAgIH0sXG5cbiAgICByZWZyZXNoOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICB0aGlzLnVwZGF0ZShkYXRhKTtcbiAgICAgICAgdGhpcy4kZG9tLm11bHRpc2VsZWN0KCdyZWJ1aWxkJyk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBCb290c3RyYXBSZW5kZXJlcjsiLCIndXNlIHN0cmljdCc7XG5cbnZhciAkID0gKHdpbmRvdy4kKTtcbnZhciBGaWx0ZXJzID0gcmVxdWlyZSgnLi4vZmlsdGVycycpO1xudmFyIEJhc2VTZWxlY3QgPSByZXF1aXJlKCcuL2Jhc2VzZWxlY3QnKTtcblxudmFyIFNpbXBsZVNlbGVjdEZpbHRlciA9ICQuZXh0ZW5kKHt9LCBCYXNlU2VsZWN0LlNlbGVjdEZpbHRlciwge1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIHNpbXBsZSBzZWxlY3RcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtTaW1wbGVTZWxlY3RGaWx0ZXJ9XG4gICAgICovXG4gICAgaW5pdDogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLiRkb20gPSAkKCc8c2VsZWN0IGNsYXNzPVwiZmlsdHJlXCIvPicpO1xuICAgICAgICB0aGlzLiRkb20ub24oJ2NoYW5nZScsIHRoaXMuX29uQ2hhbmdlLmJpbmQodGhpcykpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGFsbCBvcHRpb25zIHdpdGhvdXQgc3BlY2lmeWluZyB0aGUgJ3NlbGVjdGVkJyBmbGFnXG4gICAgICogKHRoZSBmaXJzdCBvcHRpb24gaXMgc2VsZWN0ZWQgYnkgZGVmYXVsdClcbiAgICAgKlxuICAgICAqIEBwYXJhbSBkYXRhXG4gICAgICogQHJldHVybnMge1NpbXBsZVNlbGVjdEZpbHRlcn1cbiAgICAgKi9cbiAgICBwb3B1bGF0ZTogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgdGhpcy5fYWRkT3B0aW9ucyhkYXRhLCB0aGlzLl9yZWZyZXNoT3B0aW9uKTtcbiAgICAgICAgdGhpcy5fb25DaGFuZ2UoKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmVmcmVzaCB0aGUgb3B0aW9ucyBiYXNlZCBvbiB0aGUgZmlsdGVyIHN0YXRlXG4gICAgICpcbiAgICAgKiBAcGFyYW0gZGF0YVxuICAgICAqIEByZXR1cm5zIHtTaW1wbGVTZWxlY3RGaWx0ZXJ9XG4gICAgICovXG4gICAgdXBkYXRlOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICB0aGlzLl9hZGRPcHRpb25zKGRhdGEsIHRoaXMuX3JlZnJlc2hPcHRpb24pO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBUaGlzIGZpbHRlciBpcyBkeW5hbWljLCBpdCBjYW4ndCBiZSB1c2VkIGZvciBpbml0aWFsIGZpbHRlcmluZ1xuICAgICAqXG4gICAgICogQHJldHVybnMge3N0cmluZ31cbiAgICAgKi9cbiAgICBnZXRJbml0aWFsUXVlcnk6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gJyc7XG4gICAgfVxufSk7XG5cbkZpbHRlcnMucHJvdG90eXBlLmJ1aWxkZXJzLnNlbGVjdCA9IEJhc2VTZWxlY3QuYnVpbGRlci5iaW5kKFNpbXBsZVNlbGVjdEZpbHRlcik7XG5cbm1vZHVsZS5leHBvcnRzID0gU2ltcGxlU2VsZWN0RmlsdGVyOyJdfQ==
