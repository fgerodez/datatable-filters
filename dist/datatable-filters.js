(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
'use strict';

var $ = (typeof window !== "undefined" ? window['$'] : typeof global !== "undefined" ? global['$'] : null);

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
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],2:[function(require,module,exports){
(function (global){
'use strict';

var $ = (typeof window !== "undefined" ? window['$'] : typeof global !== "undefined" ? global['$'] : null);

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
    this.options = $.extend({
        updater: 'none'
    }, this.tableAPI.init().filters);
    this.$header = $(this.tableAPI.table().header());
    this.url = this.tableAPI.ajax.url();

    settings.aoColumns.forEach(function (param, col) {
        if (param.filter && param.bVisible) {
            var options = $.extend({
                column: col,
                renderColumn: this.tableAPI.column.index('toVisible', col)
            }, param.filter);

            var filter = this.builders[param.filter.type](options);

            filter.init();

            this.applyInitialFilter(filter);
            this.filters.push(filter);
        }
    }, this);

    $.extend(this, this.updaters[this.options.updater]);

    if (this.filters.length > 0) {
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
     * Array of updater constructor function.
     * Each function take the filters to update as its single parameter
     */
    updaters: {},

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
     * @return {jQuery} The unfiltered column rendered data
     */
    getColumnData: function (col) {
        return this.tableAPI.column(col).cache('search').unique();
    },

    /**
     * Retrieves the column filtered data
     *
     * @param col {int} The column index (0 based)
     *
     * @return {jQuery} The filtered column data
     */
    getFilteredColumnData: function (col) {
        return this.tableAPI.column(col, {search: 'applied'}).cache('search').unique();
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
        this.applyFilter(params.filter)
            .refreshAllFilters(params.filter)
            .drawTable();

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
        var $container = this.$header.find('.fond-header:eq(' + filter.renderColumn + ')');

        if (filter.isServerSide()) {
            filter.register($.proxy(this.onServerFilterChange, this));
        } else {
            filter.register($.proxy(this.onClientFilterChange, this));
        }

        filter.render($container, $colHeader.html(), this.getColumnData(col));
        if(filter.className) {
          filter.$dom.addClass(filter.className);
        }
        if(filter.attrs) {
          filter.$dom.attr(filter.attrs);
        }
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
    },
});

$(document).on('preInit.dt', function (e, settings) {
    new Filters(settings);
});

module.exports = Filters;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],3:[function(require,module,exports){
(function (global){
'use strict';

var $ = (typeof window !== "undefined" ? window['$'] : typeof global !== "undefined" ? global['$'] : null);
var BaseFilter = require('../basefilter');
var SimpleRenderer = require('../renderer/simple');
var Filters = require('../filters');

var InputFilter = $.extend({}, BaseFilter, SimpleRenderer, {

    init: function () {
        this.$dom = $('<input class="filtre"/>');
        this.$dom.val(this.getInitialQuery());
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

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../basefilter":1,"../filters":2,"../renderer/simple":5}],4:[function(require,module,exports){
'use strict';

require('./updater/updateNone');
require('./updater/updateOthers');
require('./select/simpleselect');
require('./select/multiselect');
require('./select/fixedselect');
require('./input/input');
require('./filters');

},{"./filters":2,"./input/input":3,"./select/fixedselect":7,"./select/multiselect":8,"./select/simpleselect":11,"./updater/updateNone":12,"./updater/updateOthers":13}],5:[function(require,module,exports){
(function (global){
'use strict';

var $ = (typeof window !== "undefined" ? window['$'] : typeof global !== "undefined" ? global['$'] : null);

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
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],6:[function(require,module,exports){
(function (global){
'use strict';

var $ = (typeof window !== "undefined" ? window['$'] : typeof global !== "undefined" ? global['$'] : null);
var BaseFilter = require('../basefilter');
var SimpleRenderer = require('../renderer/simple');
var BootstrapRenderer = require('./renderer/bootstrap');
var ChosenRender = require('./renderer/chosen');

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

 var availableRenderers = {
    'bootstrap': BootstrapRenderer,
    'chosen': ChosenRender
};

var builder = function(settings) {
    var renderer = availableRenderers[settings.renderer] || SimpleRenderer;

    return $.extend({}, this, renderer, settings);
};

module.exports = {
    SelectFilter: SelectFilter,
    builder: builder
};
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../basefilter":1,"../renderer/simple":5,"./renderer/bootstrap":9,"./renderer/chosen":10}],7:[function(require,module,exports){
(function (global){
'use strict';

var $ = (typeof window !== "undefined" ? window['$'] : typeof global !== "undefined" ? global['$'] : null);
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
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../filters":2,"./baseselect":6}],8:[function(require,module,exports){
(function (global){
'use strict';

var $ = (typeof window !== "undefined" ? window['$'] : typeof global !== "undefined" ? global['$'] : null);
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
     * Uses getInitialQuery as default value(s)
     *
     * @param data
     * @returns {MultiSelectFilter}
     */
    populate: function (data) {
        this._addOptions(data, this._addSelectedOption);

        // Select each values returned by getInitialQuery
        var initialQuery = this.getInitialQuery();
        if(Array.isArray(initialQuery)) {
          initialQuery.forEach(function (initialQuery) {
            this.$dom.find('option[value="' + initialQuery + '"]').attr('selected', 'selected');
          })
        } else { // Asume initial query is a string
            this.$dom.find('option[value="' + initialQuery + '"]').attr('selected', 'selected');
        }
        this._saveSelection();

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

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../filters":2,"./baseselect":6}],9:[function(require,module,exports){
(function (global){
'use strict';
var $ = (typeof window !== "undefined" ? window['$'] : typeof global !== "undefined" ? global['$'] : null);

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
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],10:[function(require,module,exports){
(function (global){
'use strict';
var $ = (typeof window !== "undefined" ? window['$'] : typeof global !== "undefined" ? global['$'] : null);

var ChosenRenderer = {
    render: function ($container, header, data) {
        this.populate(data);
        this.showFilter(this.$dom, $container, header, data);
        this.$dom.chosen(this.rendererOptions || {});

        return this;
    },

    showFilter: function($dom, $container, header, data) {
        $container.append(this.$dom);
    },

    refresh: function (data) {
        this.update(data);
        this.$dom.trigger('chosen:updated');

        return this;
    }
};

module.exports = ChosenRenderer;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],11:[function(require,module,exports){
(function (global){
'use strict';

var $ = (typeof window !== "undefined" ? window['$'] : typeof global !== "undefined" ? global['$'] : null);
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
     * If an option with `getInitialQuery` value exists, selects it,
     * otherwise, the first option is selected by default
     *
     * @param data
     * @returns {SimpleSelectFilter}
     */
    populate: function (data) {
        this._addOptions(data, this._refreshOption);
        this.$dom.find('option[value="' + this.getInitialQuery() + '"]').attr('selected', 'selected');
        this._saveSelection();
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

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../filters":2,"./baseselect":6}],12:[function(require,module,exports){
(function (global){
'use strict';

var $ = (typeof window !== "undefined" ? window['$'] : typeof global !== "undefined" ? global['$'] : null);
var Filters = require('../filters');

/**
 * Dummy updater
 */
var UpdateNone = {
    refreshAllFilters: function (filter) {
        return this;
    }
}

Filters.prototype.updaters.none = UpdateNone;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../filters":2}],13:[function(require,module,exports){
(function (global){
'use strict';

var $ = (typeof window !== "undefined" ? window['$'] : typeof global !== "undefined" ? global['$'] : null);
var Filters = require('../filters');

/**
 * Each time a filter changed,
 * refresh the others filters.
 */
var UpdateOthers = {

    refreshAllFilters: function (filter) {
        // refresh all filters
        // except the changed one,
        // unless the filter is resetted.
        var filtersToRefresh = this.filters;
        if(filter.hasValue()) {
            filtersToRefresh = this.filters
            .filter(function (f) {
              return f.column !== filter.column;
          });
        }

        filtersToRefresh.forEach(function (filter) {
          filter.refresh(this.getFilteredColumnData(filter.column));
        }, this);

        return this;
    }
}

Filters.prototype.updaters.others = UpdateOthers;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../filters":2}]},{},[4])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJqcy9iYXNlZmlsdGVyLmpzIiwianMvZmlsdGVycy5qcyIsImpzL2lucHV0L2lucHV0LmpzIiwianMvbWFpbi5qcyIsImpzL3JlbmRlcmVyL3NpbXBsZS5qcyIsImpzL3NlbGVjdC9iYXNlc2VsZWN0LmpzIiwianMvc2VsZWN0L2ZpeGVkc2VsZWN0LmpzIiwianMvc2VsZWN0L211bHRpc2VsZWN0LmpzIiwianMvc2VsZWN0L3JlbmRlcmVyL2Jvb3RzdHJhcC5qcyIsImpzL3NlbGVjdC9yZW5kZXJlci9jaG9zZW4uanMiLCJqcy9zZWxlY3Qvc2ltcGxlc2VsZWN0LmpzIiwianMvdXBkYXRlci91cGRhdGVOb25lLmpzIiwianMvdXBkYXRlci91cGRhdGVPdGhlcnMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDaERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUN6UkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNuREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ1RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ3JMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNuREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDM0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNuQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDeEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUM5REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJyQnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJyQnXSA6IG51bGwpO1xyXG5cclxuLyoqXHJcbiAqIEJhc2VGaWx0ZXJcclxuICovXHJcbnZhciBCYXNlRmlsdGVyID0ge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQHJldHVybnMge0Jvb2xlYW59IFdoZXRoZXIgYSBmaWx0ZXIgY2hhbmdlIG11c3QgdHJpZ2dlciBhIGRhdGF0YWJsZSByZWxvYWQuXHJcbiAgICAgKiBEZWZhdWx0IGlzIGZhbHNlIChjbGllbnQgc2lkZSBmaWx0ZXIpLlxyXG4gICAgICovXHJcbiAgICBpc1NlcnZlclNpZGU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQHJldHVybnMge1N0cmluZ30gVGhlIHJlcXVlc3QgcGFyYW1ldGVyIGFzc29jaWF0ZWQgd2l0aCB0aGlzIGZpbHRlciAoaW4gdGhlIGZvcm0ga2V5PXBhcmFtLFxyXG4gICAgICogb25seSB1c2VkIGZvciBzZXJ2ZXIgc2lkZSBmaWx0ZXJzKVxyXG4gICAgICovXHJcbiAgICBnZXRTZXJ2ZXJRdWVyeTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiAnJztcclxuICAgIH0sXHJcblxyXG4gICAgbm90aWZ5Q2hhbmdlOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdGhpcy4kZG9tLnRyaWdnZXIoJ3VwZGF0ZS5maWx0ZXJzLmR0Jywge1xyXG4gICAgICAgICAgICBmaWx0ZXI6IHRoaXNcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQHJldHVybnMge1N0cmluZ30gVGhlIGZpbHRlciBzdHJpbmcgdG8gYmUgYXBwbGllZCB0byB0aGUgZGF0YXRhYmxlIGNvbHVtblxyXG4gICAgICovXHJcbiAgICBnZXRRdWVyeTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIGlmICghdGhpcy5oYXNWYWx1ZSgpKVxyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5ub1NlbGVjdGlvblF1ZXJ5KCk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzLnNlbGVjdGVkUXVlcnkoKTtcclxuICAgIH0sXHJcblxyXG4gICAgcmVnaXN0ZXI6IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XHJcbiAgICAgICAgdGhpcy4kZG9tLm9uKCd1cGRhdGUuZmlsdGVycy5kdCcsIGNhbGxiYWNrKTtcclxuICAgIH1cclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gQmFzZUZpbHRlcjsiLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgJCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WyckJ10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWyckJ10gOiBudWxsKTtcclxuXHJcbi8qKlxyXG4gKiBGaWx0ZXJzIGlzIGEgY29tcG9uZW50IHRoYXQgbWFuYWdlcyBhIGxpc3Qgb2YgZmlsdGVycyBvYmplY3QgaW5zaWRlXHJcbiAqIGEgZGF0YXRhYmxlIGhlYWRlciByb3cuXHJcbiAqXHJcbiAqIFRoaXMgY29uc3RydWN0b3IgYmluZHMgbGlzdGVuZXJzIHRvIHZhcmlvdXMgZGF0YXRhYmxlIGV2ZW50cy5cclxuICpcclxuICogQHBhcmFtIHNldHRpbmdzIHtPYmplY3R9IHNldHRpbmdzIG9iamVjdCB1c2VkIHRvIGNyZWF0ZSB0aGUgZGF0YXRhYmxlXHJcbiAqL1xyXG52YXIgRmlsdGVycyA9IGZ1bmN0aW9uIChzZXR0aW5ncykge1xyXG4gICAgdGhpcy50YWJsZUFQSSA9IG5ldyAkLmZuLmRhdGFUYWJsZS5BcGkoc2V0dGluZ3MpO1xyXG4gICAgdGhpcy5vcHRpb25zID0gJC5leHRlbmQoe1xyXG4gICAgICAgIHVwZGF0ZXI6ICdub25lJ1xyXG4gICAgfSwgdGhpcy50YWJsZUFQSS5pbml0KCkuZmlsdGVycyk7XHJcbiAgICB0aGlzLiRoZWFkZXIgPSAkKHRoaXMudGFibGVBUEkudGFibGUoKS5oZWFkZXIoKSk7XHJcbiAgICB0aGlzLnVybCA9IHRoaXMudGFibGVBUEkuYWpheC51cmwoKTtcclxuXHJcbiAgICBzZXR0aW5ncy5hb0NvbHVtbnMuZm9yRWFjaChmdW5jdGlvbiAocGFyYW0sIGNvbCkge1xyXG4gICAgICAgIGlmIChwYXJhbS5maWx0ZXIgJiYgcGFyYW0uYlZpc2libGUpIHtcclxuICAgICAgICAgICAgdmFyIG9wdGlvbnMgPSAkLmV4dGVuZCh7XHJcbiAgICAgICAgICAgICAgICBjb2x1bW46IGNvbCxcclxuICAgICAgICAgICAgICAgIHJlbmRlckNvbHVtbjogdGhpcy50YWJsZUFQSS5jb2x1bW4uaW5kZXgoJ3RvVmlzaWJsZScsIGNvbClcclxuICAgICAgICAgICAgfSwgcGFyYW0uZmlsdGVyKTtcclxuXHJcbiAgICAgICAgICAgIHZhciBmaWx0ZXIgPSB0aGlzLmJ1aWxkZXJzW3BhcmFtLmZpbHRlci50eXBlXShvcHRpb25zKTtcclxuXHJcbiAgICAgICAgICAgIGZpbHRlci5pbml0KCk7XHJcblxyXG4gICAgICAgICAgICB0aGlzLmFwcGx5SW5pdGlhbEZpbHRlcihmaWx0ZXIpO1xyXG4gICAgICAgICAgICB0aGlzLmZpbHRlcnMucHVzaChmaWx0ZXIpO1xyXG4gICAgICAgIH1cclxuICAgIH0sIHRoaXMpO1xyXG5cclxuICAgICQuZXh0ZW5kKHRoaXMsIHRoaXMudXBkYXRlcnNbdGhpcy5vcHRpb25zLnVwZGF0ZXJdKTtcclxuXHJcbiAgICBpZiAodGhpcy5maWx0ZXJzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICB0aGlzLnRhYmxlQVBJLm9uKCdpbml0JywgdGhpcy5vbkRhdGFUYWJsZUluaXQuYmluZCh0aGlzKSk7XHJcbiAgICB9XHJcbn07XHJcblxyXG4kLmV4dGVuZChGaWx0ZXJzLnByb3RvdHlwZSwge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQXJyYXkgb2YgZmlsdGVyIGNvbnN0cnVjdG9yIGZ1bmN0aW9uLiBFYWNoIGZ1bmN0aW9uXHJcbiAgICAgKiB0YWtlcyBhIHNldHRpbmcgb2JqZWN0IGFzIGl0cyBzaW5nbGUgcGFyYW1ldGVyXHJcbiAgICAgKi9cclxuICAgIGJ1aWxkZXJzOiB7fSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIEFycmF5IG9mIHVwZGF0ZXIgY29uc3RydWN0b3IgZnVuY3Rpb24uXHJcbiAgICAgKiBFYWNoIGZ1bmN0aW9uIHRha2UgdGhlIGZpbHRlcnMgdG8gdXBkYXRlIGFzIGl0cyBzaW5nbGUgcGFyYW1ldGVyXHJcbiAgICAgKi9cclxuICAgIHVwZGF0ZXJzOiB7fSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIFRhYmxlIGhlYWRlciBkb20gbm9kZVxyXG4gICAgICogQHR5cGUge2pRdWVyeX1cclxuICAgICAqL1xyXG4gICAgJGhlYWRlcjogbnVsbCxcclxuXHJcbiAgICAvKipcclxuICAgICAqIEZpbHRlcnMgYXJyYXlcclxuICAgICAqIEB0eXBlIHtBcnJheX1cclxuICAgICAqL1xyXG4gICAgZmlsdGVyczogW10sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUYWJsZSBpbml0aWFsIGFqYXggVVJMXHJcbiAgICAgKiBAdHlwZSB7U3RyaW5nfVxyXG4gICAgICovXHJcbiAgICB1cmw6ICcnLFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmVmcmVzaGVzIGZpbHRlcnMgYWZ0ZXIgZWFjaCBhamF4IHJlcXVlc3RcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7RmlsdGVyc31cclxuICAgICAqL1xyXG4gICAgcmVnaXN0ZXJBamF4TGlzdGVuZXI6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLnRhYmxlQVBJLm9uKCd4aHInLCAkLnByb3h5KGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdGhpcy50YWJsZUFQSS5vbmUoJ3ByZURyYXcnLCAkLnByb3h5KHRoaXMucmVmcmVzaEZpbHRlcnMsIHRoaXMpKTtcclxuICAgICAgICB9LCB0aGlzKSk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIEluaXRpYWxpemVzIHRoZSBoZWFkZXIgSFRNTCBlbGVtZW50cyB0aGF0IHdpbGwgYmUgdXNlZCB0byBob2xkIHRoZSBmaWx0ZXJzLlxyXG4gICAgICogSXQgYWxzbyByZWdpc3RlcnMgdGhlIG1haW4gZXZlbnQgaGFuZGxlciB0aGF0IHdpbGwgcmVhY3QgdG8gdGhlIGZpbHRlcnMnXHJcbiAgICAgKiB2YWx1ZSBjaGFuZ2VzLlxyXG4gICAgICpcclxuICAgICAqIFRoZSBldmVudCBuYW1lIGlzIDxiPmZpbHRlckNoYW5nZTwvYj4uIFRoaXMgZXZlbnQgbXVzdCBiZSB0cmlnZ2VyZWQgYnkgdGhlXHJcbiAgICAgKiBmaWx0ZXJzIHdoZW4gdGhlaXIgdmFsdWUgaXMgbW9kaWZpZWQgYnkgdGhlIHVzZXIgKG9yIGFueSBvdGhlciBldmVudCB0aGF0XHJcbiAgICAgKiBzaG91bGQgdHJpZ2dlciBhIGRhdGF0YWJsZSBmaWx0ZXIpLlxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJzfVxyXG4gICAgICovXHJcbiAgICBzZXR1cEhlYWRlclJvdzogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciAkZmlsdGVySGVhZGVyID0gJCgnPHRyIGNsYXNzPVwiZmlsdGVyc1wiPjwvdHI+Jyk7XHJcblxyXG4gICAgICAgIHRoaXMudGFibGVBUEkuY29sdW1ucygnOnZpc2libGUnKS5oZWFkZXIoKS5lYWNoKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgJGZpbHRlckhlYWRlci5hcHBlbmQoJzx0aCBjbGFzcz1cImZvbmQtaGVhZGVyXCI+PC90aD4nKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdGhpcy4kaGVhZGVyLmFwcGVuZCgkZmlsdGVySGVhZGVyKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmVkcmF3cyB0aGUgZGF0YXRhYmxlXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge0ZpbHRlcnN9XHJcbiAgICAgKi9cclxuICAgIGRyYXdUYWJsZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMudGFibGVBUEkuZHJhdygpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZXRyaWV2ZXMgdGhlIGNvbHVtbiBkYXRhIChjdXJyZW50IGZpbHRlciBpcyBpZ25vcmVkKVxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSBjb2wge2ludH0gVGhlIGNvbHVtbiBpbmRleCAoMCBiYXNlZClcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJuIHtqUXVlcnl9IFRoZSB1bmZpbHRlcmVkIGNvbHVtbiByZW5kZXJlZCBkYXRhXHJcbiAgICAgKi9cclxuICAgIGdldENvbHVtbkRhdGE6IGZ1bmN0aW9uIChjb2wpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy50YWJsZUFQSS5jb2x1bW4oY29sKS5jYWNoZSgnc2VhcmNoJykudW5pcXVlKCk7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmV0cmlldmVzIHRoZSBjb2x1bW4gZmlsdGVyZWQgZGF0YVxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSBjb2wge2ludH0gVGhlIGNvbHVtbiBpbmRleCAoMCBiYXNlZClcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJuIHtqUXVlcnl9IFRoZSBmaWx0ZXJlZCBjb2x1bW4gZGF0YVxyXG4gICAgICovXHJcbiAgICBnZXRGaWx0ZXJlZENvbHVtbkRhdGE6IGZ1bmN0aW9uIChjb2wpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy50YWJsZUFQSS5jb2x1bW4oY29sLCB7c2VhcmNoOiAnYXBwbGllZCd9KS5jYWNoZSgnc2VhcmNoJykudW5pcXVlKCk7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQWN0aW9ucyB0byBleGVjdXRlIHdoZW4gdGhlIGRhdGF0YWJsZSBpcyBkb25lIGluaXRpYWxpemluZy5cclxuICAgICAqIENyZWF0ZXMgdGhlIGZpbHRlciBoZWFkZXIgcm93LCByZWdpc3RlcnMgYWpheCBsaXN0ZW5lcnMgYW5kXHJcbiAgICAgKiByZW5kZXJzIGZpbHRlcnNcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7RmlsdGVyc31cclxuICAgICAqL1xyXG4gICAgb25EYXRhVGFibGVJbml0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdGhpcy5zZXR1cEhlYWRlclJvdygpLnJlZ2lzdGVyQWpheExpc3RlbmVyKCkucmVuZGVyRmlsdGVycygpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBXaGVuIGEgY2xpZW50LXNpZGUgZmlsdGVyIGNoYW5nZXMsIGFwcGxpZXMgaXRzIG5ldyB2YWx1ZVxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSBldmVudCB7RXZlbnR9IGV2ZW50IG9iamVjdFxyXG4gICAgICogQHBhcmFtIHBhcmFtcyB7T2JqZWN0fSBldmVudCBwYXJhbXNcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJuIHtGaWx0ZXJzfVxyXG4gICAgICovXHJcbiAgICBvbkNsaWVudEZpbHRlckNoYW5nZTogZnVuY3Rpb24gKGV2ZW50LCBwYXJhbXMpIHtcclxuICAgICAgICB0aGlzLmFwcGx5RmlsdGVyKHBhcmFtcy5maWx0ZXIpXHJcbiAgICAgICAgICAgIC5yZWZyZXNoQWxsRmlsdGVycyhwYXJhbXMuZmlsdGVyKVxyXG4gICAgICAgICAgICAuZHJhd1RhYmxlKCk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIFdoZW4gYSBzZXJ2ZXItc2lkZSBmaWx0ZXIgY2hhbmdlcywgYnVpbGRzIHRoZSBuZXcgYWpheCBxdWVyeSBhbmQgcmVmcmVzaGVzIHRoZSB0YWJsZVxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm4ge0ZpbHRlcnN9XHJcbiAgICAgKi9cclxuICAgIG9uU2VydmVyRmlsdGVyQ2hhbmdlOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIHNlcnZlclF1ZXJ5ID0gJC5ncmVwKHRoaXMuZmlsdGVycywgZnVuY3Rpb24gKGZpbHRlcikge1xyXG4gICAgICAgICAgICByZXR1cm4gZmlsdGVyLmlzU2VydmVyU2lkZSgpO1xyXG4gICAgICAgIH0pLm1hcChmdW5jdGlvbiAoZmlsdGVyKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmaWx0ZXIuZ2V0U2VydmVyUXVlcnkoKTtcclxuICAgICAgICB9KS5qb2luKCcmJyk7XHJcblxyXG4gICAgICAgIHRoaXMudGFibGVBUEkuYWpheC51cmwodGhpcy51cmwgKyAnPycgKyBzZXJ2ZXJRdWVyeSkuYWpheC5yZWxvYWQoKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQXBwbGllcyB0aGUgZmlsdGVyIHZhbHVlIHRvIHRoZSByZWxhdGVkIGNvbHVtblxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSBmaWx0ZXIgVGhlIGZpbHRlciBvYmplY3RcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJuIHtGaWx0ZXJzfVxyXG4gICAgICovXHJcbiAgICBhcHBseUZpbHRlcjogZnVuY3Rpb24gKGZpbHRlcikge1xyXG4gICAgICAgIHRoaXMudGFibGVBUEkuY29sdW1uKGZpbHRlci5jb2x1bW4pLnNlYXJjaChcclxuICAgICAgICAgICAgZmlsdGVyLmdldFF1ZXJ5KCksXHJcbiAgICAgICAgICAgIGZpbHRlci5pc1JlZ2V4TWF0Y2goKVxyXG4gICAgICAgICAgICAsIGZhbHNlKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRW5hYmxlcyBmaWx0ZXJzIHRvIGFwcGx5IGFuIGluaXRpYWwgY29sdW1uIGZpbHRlciwgYmVmb3JlXHJcbiAgICAgKiBhbnkgZGF0YSBwcm9jZXNzaW5nL2Rpc3BsYXlpbmcgaXMgZG9uZS5cclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0gZmlsdGVyXHJcbiAgICAgKiBAcmV0dXJucyB7RmlsdGVyc31cclxuICAgICAqL1xyXG4gICAgYXBwbHlJbml0aWFsRmlsdGVyOiBmdW5jdGlvbiAoZmlsdGVyKSB7XHJcbiAgICAgICAgdGhpcy50YWJsZUFQSS5jb2x1bW4oZmlsdGVyLmNvbHVtbikuc2VhcmNoKFxyXG4gICAgICAgICAgICBmaWx0ZXIuZ2V0SW5pdGlhbFF1ZXJ5KCksXHJcbiAgICAgICAgICAgIGZpbHRlci5pc1JlZ2V4TWF0Y2goKVxyXG4gICAgICAgICAgICAsIGZhbHNlKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQHNlZSB0aGlzLnJlbmRlckZpbHRlclxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJzfVxyXG4gICAgICovXHJcbiAgICByZW5kZXJGaWx0ZXJzOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdGhpcy5maWx0ZXJzLmZvckVhY2godGhpcy5yZW5kZXJGaWx0ZXIsIHRoaXMpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBBc2tzIGEgZmlsdGVyIHRvIHJlbmRlciBpdHNlbGYgYW5kIHByb3ZpZGVzIGFuIG9wdGlvbmFsIGNvbnRhaW5lclxyXG4gICAgICogZm9yIGZpbHRlcnMgdGhhdCBuZWVkIHRvIGJlIHJlbmRlcmVkIGluc2lkZSB0aGUgZGF0YXRhYmxlIGhlYWRlciByb3dcclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0gZmlsdGVyIFRoZSBmaWx0ZXIgb2JqZWN0XHJcbiAgICAgKi9cclxuICAgIHJlbmRlckZpbHRlcjogZnVuY3Rpb24gKGZpbHRlcikge1xyXG4gICAgICAgIHZhciBjb2wgPSBmaWx0ZXIuY29sdW1uO1xyXG4gICAgICAgIHZhciAkY29sSGVhZGVyID0gJCh0aGlzLnRhYmxlQVBJLmNvbHVtbihjb2wpLmhlYWRlcigpKTtcclxuICAgICAgICB2YXIgJGNvbnRhaW5lciA9IHRoaXMuJGhlYWRlci5maW5kKCcuZm9uZC1oZWFkZXI6ZXEoJyArIGZpbHRlci5yZW5kZXJDb2x1bW4gKyAnKScpO1xyXG5cclxuICAgICAgICBpZiAoZmlsdGVyLmlzU2VydmVyU2lkZSgpKSB7XHJcbiAgICAgICAgICAgIGZpbHRlci5yZWdpc3RlcigkLnByb3h5KHRoaXMub25TZXJ2ZXJGaWx0ZXJDaGFuZ2UsIHRoaXMpKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBmaWx0ZXIucmVnaXN0ZXIoJC5wcm94eSh0aGlzLm9uQ2xpZW50RmlsdGVyQ2hhbmdlLCB0aGlzKSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmaWx0ZXIucmVuZGVyKCRjb250YWluZXIsICRjb2xIZWFkZXIuaHRtbCgpLCB0aGlzLmdldENvbHVtbkRhdGEoY29sKSk7XHJcbiAgICAgICAgaWYoZmlsdGVyLmNsYXNzTmFtZSkge1xyXG4gICAgICAgICAgZmlsdGVyLiRkb20uYWRkQ2xhc3MoZmlsdGVyLmNsYXNzTmFtZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmKGZpbHRlci5hdHRycykge1xyXG4gICAgICAgICAgZmlsdGVyLiRkb20uYXR0cihmaWx0ZXIuYXR0cnMpO1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZWZyZXNoZXMgdGhlIGZpbHRlcnMgYmFzZWQgb24gdGhlIGN1cnJlbnRseSBkaXNwbGF5ZWQgZGF0YSBmb3IgZWFjaCBjb2x1bW5cclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJuIHtGaWx0ZXJzfVxyXG4gICAgICovXHJcbiAgICByZWZyZXNoRmlsdGVyczogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMuZmlsdGVycy5mb3JFYWNoKGZ1bmN0aW9uIChmaWx0ZXIpIHtcclxuICAgICAgICAgICAgZmlsdGVyLnJlZnJlc2godGhpcy5nZXRDb2x1bW5EYXRhKGZpbHRlci5jb2x1bW4pKTtcclxuICAgICAgICAgICAgdGhpcy5hcHBseUZpbHRlcihmaWx0ZXIpO1xyXG4gICAgICAgIH0sIHRoaXMpO1xyXG5cclxuICAgICAgICB0aGlzLmRyYXdUYWJsZSgpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcbn0pO1xyXG5cclxuJChkb2N1bWVudCkub24oJ3ByZUluaXQuZHQnLCBmdW5jdGlvbiAoZSwgc2V0dGluZ3MpIHtcclxuICAgIG5ldyBGaWx0ZXJzKHNldHRpbmdzKTtcclxufSk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEZpbHRlcnM7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJyQnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJyQnXSA6IG51bGwpO1xyXG52YXIgQmFzZUZpbHRlciA9IHJlcXVpcmUoJy4uL2Jhc2VmaWx0ZXInKTtcclxudmFyIFNpbXBsZVJlbmRlcmVyID0gcmVxdWlyZSgnLi4vcmVuZGVyZXIvc2ltcGxlJyk7XHJcbnZhciBGaWx0ZXJzID0gcmVxdWlyZSgnLi4vZmlsdGVycycpO1xyXG5cclxudmFyIElucHV0RmlsdGVyID0gJC5leHRlbmQoe30sIEJhc2VGaWx0ZXIsIFNpbXBsZVJlbmRlcmVyLCB7XHJcblxyXG4gICAgaW5pdDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMuJGRvbSA9ICQoJzxpbnB1dCBjbGFzcz1cImZpbHRyZVwiLz4nKTtcclxuICAgICAgICB0aGlzLiRkb20udmFsKHRoaXMuZ2V0SW5pdGlhbFF1ZXJ5KCkpO1xyXG4gICAgICAgIHRoaXMuJGRvbS5vbignaW5wdXQnLCB0aGlzLm5vdGlmeUNoYW5nZS5iaW5kKHRoaXMpKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIHBvcHVsYXRlOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIHVwZGF0ZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICBub1NlbGVjdGlvblF1ZXJ5OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuICcnO1xyXG4gICAgfSxcclxuXHJcbiAgICBpc1JlZ2V4TWF0Y2g6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH0sXHJcblxyXG4gICAgaGFzVmFsdWU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy4kZG9tLnZhbCgpICE9ICcnO1xyXG4gICAgfSxcclxuXHJcbiAgICBzZWxlY3RlZFF1ZXJ5OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuJGRvbS52YWwoKTtcclxuICAgIH0sXHJcblxyXG4gICAgZ2V0SW5pdGlhbFF1ZXJ5OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuICcnO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbkZpbHRlcnMucHJvdG90eXBlLmJ1aWxkZXJzLmlucHV0ID0gZnVuY3Rpb24oc2V0dGluZ3MpIHtcclxuICByZXR1cm4gJC5leHRlbmQoe30sIElucHV0RmlsdGVyLCBzZXR0aW5ncyk7XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IElucHV0RmlsdGVyO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG5yZXF1aXJlKCcuL3VwZGF0ZXIvdXBkYXRlTm9uZScpO1xyXG5yZXF1aXJlKCcuL3VwZGF0ZXIvdXBkYXRlT3RoZXJzJyk7XHJcbnJlcXVpcmUoJy4vc2VsZWN0L3NpbXBsZXNlbGVjdCcpO1xyXG5yZXF1aXJlKCcuL3NlbGVjdC9tdWx0aXNlbGVjdCcpO1xyXG5yZXF1aXJlKCcuL3NlbGVjdC9maXhlZHNlbGVjdCcpO1xyXG5yZXF1aXJlKCcuL2lucHV0L2lucHV0Jyk7XHJcbnJlcXVpcmUoJy4vZmlsdGVycycpO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgJCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WyckJ10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWyckJ10gOiBudWxsKTtcclxuXHJcbnZhciBTaW1wbGVSZW5kZXJlciA9IHtcclxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCRjb250YWluZXIsIGhlYWRlciwgZGF0YSkge1xyXG4gICAgICAgIHRoaXMucG9wdWxhdGUoZGF0YSk7XHJcbiAgICAgICAgdGhpcy5zaG93RmlsdGVyKHRoaXMuJGRvbSwgJGNvbnRhaW5lciwgaGVhZGVyLCBkYXRhKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIHNob3dGaWx0ZXI6IGZ1bmN0aW9uKCRkb20sICRjb250YWluZXIsIGhlYWRlciwgZGF0YSkge1xyXG4gICAgICAgICRjb250YWluZXIuYXBwZW5kKHRoaXMuJGRvbSk7XHJcbiAgICAgICAgdGhpcy4kZG9tLmF0dHIoJ25hbWUnLCBoZWFkZXIpLmF0dHIoJ3BsYWNlaG9sZGVyJywgaGVhZGVyKS5zaG93KCk7XHJcbiAgICB9LFxyXG5cclxuICAgIHJlZnJlc2g6IGZ1bmN0aW9uIChkYXRhKSB7XHJcbiAgICAgICAgdGhpcy51cGRhdGUoZGF0YSk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBTaW1wbGVSZW5kZXJlcjsiLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgJCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WyckJ10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWyckJ10gOiBudWxsKTtcclxudmFyIEJhc2VGaWx0ZXIgPSByZXF1aXJlKCcuLi9iYXNlZmlsdGVyJyk7XHJcbnZhciBTaW1wbGVSZW5kZXJlciA9IHJlcXVpcmUoJy4uL3JlbmRlcmVyL3NpbXBsZScpO1xyXG52YXIgQm9vdHN0cmFwUmVuZGVyZXIgPSByZXF1aXJlKCcuL3JlbmRlcmVyL2Jvb3RzdHJhcCcpO1xyXG52YXIgQ2hvc2VuUmVuZGVyID0gcmVxdWlyZSgnLi9yZW5kZXJlci9jaG9zZW4nKTtcclxuXHJcbi8qKlxyXG4gKiBTZWxlY3RGaWx0ZXIgcmVncm91cHMgY29tbW9uIGJlaGF2aW9yIGZvciBzZWxlY3QgZmlsdGVyc1xyXG4gKi9cclxudmFyIFNlbGVjdEZpbHRlciA9ICQuZXh0ZW5kKHt9LCBCYXNlRmlsdGVyLCB7XHJcbiAgICBzZWxlY3RlZDogW10sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBAcmV0dXJucyB7c3RyaW5nfSBSZXR1cm5zIGFuIGFsd2F5cyBmYWxzZSByZWdleCB0byBoaWRlIGV2ZXJ5IHJlY29yZHNcclxuICAgICAqIHdoZW4gbm8gb3B0aW9uIGlzIHNlbGVjdGVkXHJcbiAgICAgKi9cclxuICAgIG5vU2VsZWN0aW9uUXVlcnk6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gJyQuXic7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFRydWUuIFNlbGVjdCBmaWx0ZXJzIGFsd2F5cyB1c2UgcmVnZXhcclxuICAgICAqL1xyXG4gICAgaXNSZWdleE1hdGNoOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQHJldHVybnMge2Jvb2xlYW59IFJldHVybnMgdHJ1ZSBpZiBhdCBsZWFzdCBvbmUgb3B0aW9uIGlzIHNlbGVjdGVkXHJcbiAgICAgKi9cclxuICAgIGhhc1ZhbHVlOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX2dldFNlbGVjdGlvbigpLmxlbmd0aCA+IDA7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQHJldHVybnMge1N0cmluZ30gVGhlIGNvbHVtbiBmaWx0ZXIgcXVlcnkgdG8gYXBwbHkuIFNlbGVjdGVkIG9wdGlvbiB2YWx1ZXNcclxuICAgICAqIGFyZSBjb25jYXRlbmF0ZWQgaW50byBhIHN0cmluZyB1c2luZyB0aGUgcGlwZSBjaGFyYWN0ZXIgKHJlZ2V4IG9yKVxyXG4gICAgICovXHJcbiAgICBzZWxlY3RlZFF1ZXJ5OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX2dldFNlbGVjdGlvbigpLm1hcChmdW5jdGlvbiAodmFsdWUpIHtcclxuICAgICAgICAgICAgaWYgKHZhbHVlID09IHRoaXMuYWxsVGV4dCAgfHwgdGhpcy5fZ2V0Tm90U2VsZWN0ZWQoKS5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiAnJztcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiAnXicgKyAkLmZuLmRhdGFUYWJsZS51dGlsLmVzY2FwZVJlZ2V4KHZhbHVlKSArICckJztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sIHRoaXMpLmpvaW4oJ3wnKTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBGaWx0ZXJzIHRoZSBvcHRpb25zIGJlZm9yZSBhZGRpbmcgdGhlbSB0byB0aGUgc2VsZWN0LiBDYW4gYmUgb3ZlcnJpZGRlblxyXG4gICAgICogZm9yIHNwZWNpZmljIGZpbHRlcmluZ1xyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSB2YWx1ZSB7U3RyaW5nfSBPcHRpb24gdmFsdWVcclxuICAgICAqL1xyXG4gICAgZmlsdGVyT3B0aW9uczogZnVuY3Rpb24gKHZhbHVlKSB7XHJcbiAgICAgICAgcmV0dXJuIHZhbHVlLnRyaW0oKSAhPSAnJztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBTb3J0IHRoZSBvcHRpb25zIGJlZm9yZSBhZGRpbmcgdGhlbSB0byB0aGUgc2VsZWN0LiBDYW4gYmUgb3ZlcnJpZGRlbiBmb3JcclxuICAgICAqIHNwZWNpZmljIHNvcnRzXHJcbiAgICAgKi9cclxuICAgIHNvcnRPcHRpb25zOiBmdW5jdGlvbiAoYSwgYikge1xyXG4gICAgICAgIGlmIChhID4gYikge1xyXG4gICAgICAgICAgICByZXR1cm4gMTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChhIDwgYikge1xyXG4gICAgICAgICAgICByZXR1cm4gLTE7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gMDtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBAcmV0dXJucyB7QXJyYXk8U3RyaW5nPn0gVGhlIGFycmF5IG9mIHNlbGVjdGVkIHZhbHVlc1xyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqL1xyXG4gICAgX2dldFNlbGVjdGlvbjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLiRkb20uZmluZCgnb3B0aW9uOnNlbGVjdGVkJykudG9BcnJheSgpLm1hcChmdW5jdGlvbihvcHRpb24pIHtcclxuICAgICAgICAgICAgcmV0dXJuIG9wdGlvbi52YWx1ZTtcclxuICAgICAgICB9KTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMgeyp8QXJyYXl9IFRoZSBhcnJheSBvZiBub24gc2VsZWN0ZWQgdmFsdWVzXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICovXHJcbiAgICBfZ2V0Tm90U2VsZWN0ZWQ6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLiRkb20uZmluZCgnOm5vdChvcHRpb246c2VsZWN0ZWQpJykudG9BcnJheSgpLm1hcChmdW5jdGlvbihvcHRpb24pIHtcclxuICAgICAgICAgICAgcmV0dXJuIG9wdGlvbi52YWx1ZTtcclxuICAgICAgICB9KTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBGb3IgZWFjaCBlbGVtZW50IGluIHRoZSBkYXRhIG9iamVjdCwgY3JlYXRlcyBhbiBvcHRpb24gZWxlbWVudCB1c2luZyB0aGUgZnVuY3Rpb25cclxuICAgICAqIGZuQ3JlYXRlXHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtIGRhdGEge2pRdWVyeX0gVGhlIGRhdGEgdG8gYWRkIHRvIHRoZSBzZWxlY3RcclxuICAgICAqIEBwYXJhbSBmbkNyZWF0ZSB7RnVuY3Rpb259IFRoZSBmdW5jdGlvbiB0byB1c2UgdG8gY3JlYXRlIHRoZSBvcHRpb25zXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICovXHJcbiAgICBfYWRkT3B0aW9uczogZnVuY3Rpb24gKGRhdGEsIGZuQ3JlYXRlKSB7XHJcbiAgICAgICAgdGhpcy4kZG9tLmVtcHR5KCk7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLmFsbFRleHQpXHJcbiAgICAgICAgICAgIGZuQ3JlYXRlLmNhbGwodGhpcywgdGhpcy5hbGxUZXh0KTtcclxuXHJcbiAgICAgICAgZGF0YS50b0FycmF5KCkuZmlsdGVyKHRoaXMuZmlsdGVyT3B0aW9ucykuc29ydCh0aGlzLnNvcnRPcHRpb25zKS5mb3JFYWNoKGZuQ3JlYXRlLCB0aGlzKTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGVzIGEgc2VsZWN0ZWQgb3B0aW9uXHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtIHZhbHVlIHtTdHJpbmd9IFRoZSBvcHRpb24gdmFsdWVcclxuICAgICAqIEBwcml2YXRlXHJcbiAgICAgKi9cclxuICAgIF9hZGRTZWxlY3RlZE9wdGlvbjogZnVuY3Rpb24gKHZhbHVlKSB7XHJcbiAgICAgICAgdGhpcy4kZG9tLmFwcGVuZCgkKCc8b3B0aW9uLz4nKVxyXG4gICAgICAgICAgICAudmFsKHZhbHVlKVxyXG4gICAgICAgICAgICAudGV4dCh2YWx1ZSlcclxuICAgICAgICAgICAgLmF0dHIoJ3NlbGVjdGVkJywgJ3NlbGVjdGVkJylcclxuICAgICAgICApO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgYW4gb3B0aW9uIHdpdGggdGhlIHNlbGVjdGVkIGZsYWcgYmFzZWQgb24gdGhlXHJcbiAgICAgKiBjdXJyZW50IGZpbHRlciBzdGF0ZVxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSB2YWx1ZSB7U3RyaW5nfSBUaGUgb3B0aW9uIHZhbHVlXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICovXHJcbiAgICBfcmVmcmVzaE9wdGlvbjogZnVuY3Rpb24gKHZhbHVlKSB7XHJcbiAgICAgICAgdmFyICRvcHRpb24gPSAkKCc8b3B0aW9uLz4nKVxyXG4gICAgICAgICAgICAudmFsKHZhbHVlKVxyXG4gICAgICAgICAgICAudGV4dCh2YWx1ZSk7XHJcblxyXG4gICAgICAgIGlmICgkLmluQXJyYXkodmFsdWUsIHRoaXMuc2VsZWN0ZWQpID4gLTEpXHJcbiAgICAgICAgICAgICRvcHRpb24uYXR0cignc2VsZWN0ZWQnLCAnc2VsZWN0ZWQnKTtcclxuXHJcbiAgICAgICAgdGhpcy4kZG9tLmFwcGVuZCgkb3B0aW9uKTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUYWtlcyBhIHNuYXBzaG90IG9mIHRoZSBjdXJyZW50IHNlbGVjdGlvbiBzdGF0ZVxyXG4gICAgICpcclxuICAgICAqIEBwcml2YXRlXHJcbiAgICAgKi9cclxuICAgIF9zYXZlU2VsZWN0aW9uOiBmdW5jdGlvbigpIHtcclxuICAgICAgICB0aGlzLnNlbGVjdGVkID0gdGhpcy5fZ2V0U2VsZWN0aW9uKCk7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogV2hlbmV2ZXIgdGhlIHNlbGVjdCBzdGF0ZSBjaGFuZ2VzLCBzYXZlIGl0cyBuZXcgc3RhdGUgYW5kXHJcbiAgICAgKiBub3RpZnkgdGhlIGxpc3RlbmluZyBjb21wb25lbnRcclxuICAgICAqXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICovXHJcbiAgICBfb25DaGFuZ2U6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHRoaXMuX3NhdmVTZWxlY3Rpb24oKTtcclxuICAgICAgICB0aGlzLm5vdGlmeUNoYW5nZSgpO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbiB2YXIgYXZhaWxhYmxlUmVuZGVyZXJzID0ge1xyXG4gICAgJ2Jvb3RzdHJhcCc6IEJvb3RzdHJhcFJlbmRlcmVyLFxyXG4gICAgJ2Nob3Nlbic6IENob3NlblJlbmRlclxyXG59O1xyXG5cclxudmFyIGJ1aWxkZXIgPSBmdW5jdGlvbihzZXR0aW5ncykge1xyXG4gICAgdmFyIHJlbmRlcmVyID0gYXZhaWxhYmxlUmVuZGVyZXJzW3NldHRpbmdzLnJlbmRlcmVyXSB8fCBTaW1wbGVSZW5kZXJlcjtcclxuXHJcbiAgICByZXR1cm4gJC5leHRlbmQoe30sIHRoaXMsIHJlbmRlcmVyLCBzZXR0aW5ncyk7XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IHtcclxuICAgIFNlbGVjdEZpbHRlcjogU2VsZWN0RmlsdGVyLFxyXG4gICAgYnVpbGRlcjogYnVpbGRlclxyXG59OyIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJyQnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJyQnXSA6IG51bGwpO1xyXG52YXIgRmlsdGVycyA9IHJlcXVpcmUoJy4uL2ZpbHRlcnMnKTtcclxudmFyIEJhc2VTZWxlY3QgPSByZXF1aXJlKCcuL2Jhc2VzZWxlY3QnKTtcclxuXHJcbnZhciBGaXhlZFNlbGVjdEZpbHRlciA9ICQuZXh0ZW5kKHt9LCBCYXNlU2VsZWN0LlNlbGVjdEZpbHRlciwge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogU2ltcGx5IHNhdmVzIGEgaGFuZGxlIG9uIHRoZSBwcm92aWRlZCBzb3VyY2Ugc2VsZWN0XHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge0ZpeGVkU2VsZWN0RmlsdGVyfVxyXG4gICAgICovXHJcbiAgICBpbml0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdGhpcy4kZG9tID0gJCh0aGlzLnNyYyk7XHJcbiAgICAgICAgdGhpcy4kZG9tLm9uKCdjaGFuZ2UnLCB0aGlzLm5vdGlmeUNoYW5nZS5iaW5kKHRoaXMpKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogTm8gYWN0aW9uIGZvciBmaXhlZCBmaWx0ZXJzOiB0aGUgcHJvdmlkZWQgc2VsZWN0IGlzIHVzZWQgYXMgaXNcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7Rml4ZWRTZWxlY3RGaWx0ZXJ9XHJcbiAgICAgKi9cclxuICAgIHBvcHVsYXRlOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogTm8gdXBkYXRlIGZvciBmaXhlZCBmaWx0ZXJzOiB0aGUgcHJvdmlkZWQgc2VsZWN0IGlzIG5ldmVyIGNoYW5nZWRcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7Rml4ZWRTZWxlY3RGaWx0ZXJ9XHJcbiAgICAgKi9cclxuICAgIHVwZGF0ZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIEZpeGVkIGZpbHRlcnMgY2FuIGJlIHVzZWQgdG8gcHJvdmlkZSBpbml0aWFsIGZpbHRlcnMgdG8gYXBwbHkgdG8gdGhlXHJcbiAgICAgKiBkYXRhdGFibGUuXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMgeyp8U3RyaW5nfVxyXG4gICAgICovXHJcbiAgICBnZXRJbml0aWFsUXVlcnk6IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLmdldFF1ZXJ5KCk7XHJcbiAgICB9XHJcbn0pO1xyXG5cclxuRmlsdGVycy5wcm90b3R5cGUuYnVpbGRlcnMuZml4ZWRzZWxlY3QgPSBCYXNlU2VsZWN0LmJ1aWxkZXIuYmluZChGaXhlZFNlbGVjdEZpbHRlcik7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEZpeGVkU2VsZWN0RmlsdGVyOyIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJyQnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJyQnXSA6IG51bGwpO1xyXG52YXIgRmlsdGVycyA9IHJlcXVpcmUoJy4uL2ZpbHRlcnMnKTtcclxudmFyIEJhc2VTZWxlY3QgPSByZXF1aXJlKCcuL2Jhc2VzZWxlY3QnKTtcclxuXHJcbnZhciBNdWx0aVNlbGVjdEZpbHRlciA9ICQuZXh0ZW5kKHt9LCBCYXNlU2VsZWN0LlNlbGVjdEZpbHRlciwge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogSW5pdGlhbGl6ZXMgYSBtdWx0aXNlbGVjdCBkb20gb2JqZWN0XHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge011bHRpU2VsZWN0RmlsdGVyfVxyXG4gICAgICovXHJcbiAgICBpbml0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdGhpcy4kZG9tID0gJCgnPHNlbGVjdCBjbGFzcz1cImZpbHRyZVwiLz4nKS5hdHRyKCdtdWx0aXBsZScsICdtdWx0aXBsZScpO1xyXG4gICAgICAgIHRoaXMuJGRvbS5vbignY2hhbmdlJywgdGhpcy5fb25DaGFuZ2UuYmluZCh0aGlzKSk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIFBvcHVsYXRlcyB0aGUgbXVsdGlzZWxlY3Qgd2l0aCAnc2VsZWN0ZWQnIG9wdGlvbnMgYnkgZGVmYXVsdFxyXG4gICAgICogVXNlcyBnZXRJbml0aWFsUXVlcnkgYXMgZGVmYXVsdCB2YWx1ZShzKVxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSBkYXRhXHJcbiAgICAgKiBAcmV0dXJucyB7TXVsdGlTZWxlY3RGaWx0ZXJ9XHJcbiAgICAgKi9cclxuICAgIHBvcHVsYXRlOiBmdW5jdGlvbiAoZGF0YSkge1xyXG4gICAgICAgIHRoaXMuX2FkZE9wdGlvbnMoZGF0YSwgdGhpcy5fYWRkU2VsZWN0ZWRPcHRpb24pO1xyXG5cclxuICAgICAgICAvLyBTZWxlY3QgZWFjaCB2YWx1ZXMgcmV0dXJuZWQgYnkgZ2V0SW5pdGlhbFF1ZXJ5XHJcbiAgICAgICAgdmFyIGluaXRpYWxRdWVyeSA9IHRoaXMuZ2V0SW5pdGlhbFF1ZXJ5KCk7XHJcbiAgICAgICAgaWYoQXJyYXkuaXNBcnJheShpbml0aWFsUXVlcnkpKSB7XHJcbiAgICAgICAgICBpbml0aWFsUXVlcnkuZm9yRWFjaChmdW5jdGlvbiAoaW5pdGlhbFF1ZXJ5KSB7XHJcbiAgICAgICAgICAgIHRoaXMuJGRvbS5maW5kKCdvcHRpb25bdmFsdWU9XCInICsgaW5pdGlhbFF1ZXJ5ICsgJ1wiXScpLmF0dHIoJ3NlbGVjdGVkJywgJ3NlbGVjdGVkJyk7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICAgIH0gZWxzZSB7IC8vIEFzdW1lIGluaXRpYWwgcXVlcnkgaXMgYSBzdHJpbmdcclxuICAgICAgICAgICAgdGhpcy4kZG9tLmZpbmQoJ29wdGlvblt2YWx1ZT1cIicgKyBpbml0aWFsUXVlcnkgKyAnXCJdJykuYXR0cignc2VsZWN0ZWQnLCAnc2VsZWN0ZWQnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5fc2F2ZVNlbGVjdGlvbigpO1xyXG5cclxuICAgICAgICB0aGlzLl9vbkNoYW5nZSgpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBJZiB0aGUgJ2FsbCcgb3B0aW9uIGlzIHNlbGVjdGVkLCBzZXRzIHRoZSBuZXcgb3B0aW9ucyBhcyAnc2VsZWN0ZWQnLlxyXG4gICAgICogT3RoZXJ3aXNlLCBhZGRzIHRoZSBvcHRpb25zIGJhc2VkIG9uIHRoZSBmaWx0ZXIgc3RhdGVcclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0gZGF0YVxyXG4gICAgICogQHJldHVybnMge011bHRpU2VsZWN0RmlsdGVyfVxyXG4gICAgICovXHJcbiAgICB1cGRhdGU6IGZ1bmN0aW9uIChkYXRhKSB7XHJcbiAgICAgICAgaWYgKCQuaW5BcnJheSh0aGlzLmFsbFRleHQsIHRoaXMuc2VsZWN0ZWQpID4gLTEgfHwgdGhpcy5fZ2V0Tm90U2VsZWN0ZWQoKS5sZW5ndGggPT0gMClcclxuICAgICAgICAgICAgdGhpcy5fYWRkT3B0aW9ucyhkYXRhLCB0aGlzLl9hZGRTZWxlY3RlZE9wdGlvbik7XHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICB0aGlzLl9hZGRPcHRpb25zKGRhdGEsIHRoaXMuX3JlZnJlc2hPcHRpb24pO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUaGlzIGZpbHRlciBpcyBkeW5hbWljLCBpdCBjYW4ndCBiZSB1c2VkIGZvciBpbml0aWFsIGZpbHRlcmluZ1xyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9XHJcbiAgICAgKi9cclxuICAgIGdldEluaXRpYWxRdWVyeTogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgcmV0dXJuICcnO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbkZpbHRlcnMucHJvdG90eXBlLmJ1aWxkZXJzLm11bHRpc2VsZWN0ID0gQmFzZVNlbGVjdC5idWlsZGVyLmJpbmQoTXVsdGlTZWxlY3RGaWx0ZXIpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBNdWx0aVNlbGVjdEZpbHRlcjtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG52YXIgJCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WyckJ10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWyckJ10gOiBudWxsKTtcclxuXHJcbnZhciBCb290c3RyYXBSZW5kZXJlciA9IHtcclxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCRjb250YWluZXIsIGhlYWRlciwgZGF0YSkge1xyXG4gICAgICAgIHRoaXMucG9wdWxhdGUoZGF0YSk7XHJcbiAgICAgICAgdGhpcy5zaG93RmlsdGVyKHRoaXMuJGRvbSwgJGNvbnRhaW5lciwgaGVhZGVyLCBkYXRhKTtcclxuXHJcbiAgICAgICAgdmFyIGRlZmF1bHRPcHRpb25zID0ge1xyXG4gICAgICAgICAgICBidXR0b25UZXh0OiBmdW5jdGlvbiAob3B0aW9ucykge1xyXG4gICAgICAgICAgICAgICAgdmFyIG5iU2VsZWN0ZWQgPSAkKG9wdGlvbnMpLmZpbHRlcignOnNlbGVjdGVkJykubGVuZ3RoO1xyXG4gICAgICAgICAgICAgICAgaWYobmJTZWxlY3RlZCA9PSAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGhlYWRlcjtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiBoZWFkZXIgKyAnICgnICsgbmJTZWxlY3RlZCArICcpJztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHRoaXMuJGRvbS5tdWx0aXNlbGVjdCgkLmV4dGVuZChkZWZhdWx0T3B0aW9ucywgdGhpcy5yZW5kZXJlck9wdGlvbnMpKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIHNob3dGaWx0ZXI6IGZ1bmN0aW9uKCRkb20sICRjb250YWluZXIsIGhlYWRlciwgZGF0YSkge1xyXG4gICAgICAgICRjb250YWluZXIuYXBwZW5kKHRoaXMuJGRvbSk7XHJcbiAgICB9LFxyXG5cclxuICAgIHJlZnJlc2g6IGZ1bmN0aW9uIChkYXRhKSB7XHJcbiAgICAgICAgdGhpcy51cGRhdGUoZGF0YSk7XHJcbiAgICAgICAgdGhpcy4kZG9tLm11bHRpc2VsZWN0KCdyZWJ1aWxkJyk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBCb290c3RyYXBSZW5kZXJlcjsiLCIndXNlIHN0cmljdCc7XHJcbnZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJyQnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJyQnXSA6IG51bGwpO1xyXG5cclxudmFyIENob3NlblJlbmRlcmVyID0ge1xyXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoJGNvbnRhaW5lciwgaGVhZGVyLCBkYXRhKSB7XHJcbiAgICAgICAgdGhpcy5wb3B1bGF0ZShkYXRhKTtcclxuICAgICAgICB0aGlzLnNob3dGaWx0ZXIodGhpcy4kZG9tLCAkY29udGFpbmVyLCBoZWFkZXIsIGRhdGEpO1xyXG4gICAgICAgIHRoaXMuJGRvbS5jaG9zZW4odGhpcy5yZW5kZXJlck9wdGlvbnMgfHwge30pO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgc2hvd0ZpbHRlcjogZnVuY3Rpb24oJGRvbSwgJGNvbnRhaW5lciwgaGVhZGVyLCBkYXRhKSB7XHJcbiAgICAgICAgJGNvbnRhaW5lci5hcHBlbmQodGhpcy4kZG9tKTtcclxuICAgIH0sXHJcblxyXG4gICAgcmVmcmVzaDogZnVuY3Rpb24gKGRhdGEpIHtcclxuICAgICAgICB0aGlzLnVwZGF0ZShkYXRhKTtcclxuICAgICAgICB0aGlzLiRkb20udHJpZ2dlcignY2hvc2VuOnVwZGF0ZWQnKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IENob3NlblJlbmRlcmVyOyIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJyQnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJyQnXSA6IG51bGwpO1xyXG52YXIgRmlsdGVycyA9IHJlcXVpcmUoJy4uL2ZpbHRlcnMnKTtcclxudmFyIEJhc2VTZWxlY3QgPSByZXF1aXJlKCcuL2Jhc2VzZWxlY3QnKTtcclxuXHJcbnZhciBTaW1wbGVTZWxlY3RGaWx0ZXIgPSAkLmV4dGVuZCh7fSwgQmFzZVNlbGVjdC5TZWxlY3RGaWx0ZXIsIHtcclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgYSBzaW1wbGUgc2VsZWN0XHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge1NpbXBsZVNlbGVjdEZpbHRlcn1cclxuICAgICAqL1xyXG4gICAgaW5pdDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMuJGRvbSA9ICQoJzxzZWxlY3QgY2xhc3M9XCJmaWx0cmVcIi8+Jyk7XHJcbiAgICAgICAgdGhpcy4kZG9tLm9uKCdjaGFuZ2UnLCB0aGlzLl9vbkNoYW5nZS5iaW5kKHRoaXMpKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQWRkcyBhbGwgb3B0aW9ucyB3aXRob3V0IHNwZWNpZnlpbmcgdGhlICdzZWxlY3RlZCcgZmxhZ1xyXG4gICAgICogSWYgYW4gb3B0aW9uIHdpdGggYGdldEluaXRpYWxRdWVyeWAgdmFsdWUgZXhpc3RzLCBzZWxlY3RzIGl0LFxyXG4gICAgICogb3RoZXJ3aXNlLCB0aGUgZmlyc3Qgb3B0aW9uIGlzIHNlbGVjdGVkIGJ5IGRlZmF1bHRcclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0gZGF0YVxyXG4gICAgICogQHJldHVybnMge1NpbXBsZVNlbGVjdEZpbHRlcn1cclxuICAgICAqL1xyXG4gICAgcG9wdWxhdGU6IGZ1bmN0aW9uIChkYXRhKSB7XHJcbiAgICAgICAgdGhpcy5fYWRkT3B0aW9ucyhkYXRhLCB0aGlzLl9yZWZyZXNoT3B0aW9uKTtcclxuICAgICAgICB0aGlzLiRkb20uZmluZCgnb3B0aW9uW3ZhbHVlPVwiJyArIHRoaXMuZ2V0SW5pdGlhbFF1ZXJ5KCkgKyAnXCJdJykuYXR0cignc2VsZWN0ZWQnLCAnc2VsZWN0ZWQnKTtcclxuICAgICAgICB0aGlzLl9zYXZlU2VsZWN0aW9uKCk7XHJcbiAgICAgICAgdGhpcy5fb25DaGFuZ2UoKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmVmcmVzaCB0aGUgb3B0aW9ucyBiYXNlZCBvbiB0aGUgZmlsdGVyIHN0YXRlXHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtIGRhdGFcclxuICAgICAqIEByZXR1cm5zIHtTaW1wbGVTZWxlY3RGaWx0ZXJ9XHJcbiAgICAgKi9cclxuICAgIHVwZGF0ZTogZnVuY3Rpb24gKGRhdGEpIHtcclxuICAgICAgICB0aGlzLl9hZGRPcHRpb25zKGRhdGEsIHRoaXMuX3JlZnJlc2hPcHRpb24pO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUaGlzIGZpbHRlciBpcyBkeW5hbWljLCBpdCBjYW4ndCBiZSB1c2VkIGZvciBpbml0aWFsIGZpbHRlcmluZ1xyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9XHJcbiAgICAgKi9cclxuICAgIGdldEluaXRpYWxRdWVyeTogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgcmV0dXJuICcnO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbkZpbHRlcnMucHJvdG90eXBlLmJ1aWxkZXJzLnNlbGVjdCA9IEJhc2VTZWxlY3QuYnVpbGRlci5iaW5kKFNpbXBsZVNlbGVjdEZpbHRlcik7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFNpbXBsZVNlbGVjdEZpbHRlcjtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snJCddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnJCddIDogbnVsbCk7XHJcbnZhciBGaWx0ZXJzID0gcmVxdWlyZSgnLi4vZmlsdGVycycpO1xyXG5cclxuLyoqXHJcbiAqIER1bW15IHVwZGF0ZXJcclxuICovXHJcbnZhciBVcGRhdGVOb25lID0ge1xyXG4gICAgcmVmcmVzaEFsbEZpbHRlcnM6IGZ1bmN0aW9uIChmaWx0ZXIpIHtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxufVxyXG5cclxuRmlsdGVycy5wcm90b3R5cGUudXBkYXRlcnMubm9uZSA9IFVwZGF0ZU5vbmU7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJyQnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJyQnXSA6IG51bGwpO1xyXG52YXIgRmlsdGVycyA9IHJlcXVpcmUoJy4uL2ZpbHRlcnMnKTtcclxuXHJcbi8qKlxyXG4gKiBFYWNoIHRpbWUgYSBmaWx0ZXIgY2hhbmdlZCxcclxuICogcmVmcmVzaCB0aGUgb3RoZXJzIGZpbHRlcnMuXHJcbiAqL1xyXG52YXIgVXBkYXRlT3RoZXJzID0ge1xyXG5cclxuICAgIHJlZnJlc2hBbGxGaWx0ZXJzOiBmdW5jdGlvbiAoZmlsdGVyKSB7XHJcbiAgICAgICAgLy8gcmVmcmVzaCBhbGwgZmlsdGVyc1xyXG4gICAgICAgIC8vIGV4Y2VwdCB0aGUgY2hhbmdlZCBvbmUsXHJcbiAgICAgICAgLy8gdW5sZXNzIHRoZSBmaWx0ZXIgaXMgcmVzZXR0ZWQuXHJcbiAgICAgICAgdmFyIGZpbHRlcnNUb1JlZnJlc2ggPSB0aGlzLmZpbHRlcnM7XHJcbiAgICAgICAgaWYoZmlsdGVyLmhhc1ZhbHVlKCkpIHtcclxuICAgICAgICAgICAgZmlsdGVyc1RvUmVmcmVzaCA9IHRoaXMuZmlsdGVyc1xyXG4gICAgICAgICAgICAuZmlsdGVyKGZ1bmN0aW9uIChmKSB7XHJcbiAgICAgICAgICAgICAgcmV0dXJuIGYuY29sdW1uICE9PSBmaWx0ZXIuY29sdW1uO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmaWx0ZXJzVG9SZWZyZXNoLmZvckVhY2goZnVuY3Rpb24gKGZpbHRlcikge1xyXG4gICAgICAgICAgZmlsdGVyLnJlZnJlc2godGhpcy5nZXRGaWx0ZXJlZENvbHVtbkRhdGEoZmlsdGVyLmNvbHVtbikpO1xyXG4gICAgICAgIH0sIHRoaXMpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxufVxyXG5cclxuRmlsdGVycy5wcm90b3R5cGUudXBkYXRlcnMub3RoZXJzID0gVXBkYXRlT3RoZXJzO1xyXG4iXX0=
