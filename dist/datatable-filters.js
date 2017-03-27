(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

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

    /**
     * Triggers an update event
     *
     * @returns {BaseFilter} The filter object
     */
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
        if (!this.hasValue()) {
            return this.noSelectionQuery();
        }

        return this.selectedQuery();
    },

    /**
     * Registers a callback to be called when the value of the filter changes
     *
     * @param {Function} callback The action to perform when the filter value changes
     *
     * @returns {BaseFilter} The filter object
     */
    register: function (callback) {
        this.$dom.on('update.filters.dt', callback);

        return this;
    },

    /**
     * Adds a css class to the filter component
     *
     * @param {String} cssClass The css class to add
     *
     * @returns {BaseFilter} The filter object
     */
    addClass: function (cssClass) {
        this.$dom.addClass(cssClass);

        return this;
    },

    /**
     * Sets the given values as attributes of the filter component
     *
     * @param {Array} attrs An object of attribute-value pairs to set
     *
     * @returns {BaseFilter} The filter object
     */
    addAttributes: function (attrs) {
        this.$dom.attr(attrs);

        return this;
    }
};

module.exports = BaseFilter;
},{}],2:[function(require,module,exports){
(function (global){
'use strict';

var $ = (typeof window !== "undefined" ? window['$'] : typeof global !== "undefined" ? global['$'] : null);

/**
 * Filters is a component that manages a list of filter objects inside
 * a datatable header row.
 *
 * This constructor binds listeners to various datatable events.
 *
 * @param {Object} settings object used to create the datatable
 */
var Filters = function (settings) {
    this.tableAPI = new $.fn.dataTable.Api(settings);
    this.$header = $(this.tableAPI.table().header());
    this.url = this.tableAPI.ajax.url();

    this.options = $.extend({}, this.defaultSettings, this.tableAPI.init().filters);
    $.extend(this, this.updaters[this.options.updater]);

    this.filters = settings.aoColumns.filter(function (param) {
        return param.filter && param.bVisible;
    }).map(function (param) {
        var options = $.extend({
            column: param.idx,
            renderColumn: this.tableAPI.column.index('toVisible', param.idx)
        }, param.filter);

        var filter = this.builders[param.filter.type](options);

        filter.init();

        if (param.filter.className) {
            filter.addClass(param.filter.className);
        }

        if (param.filter.attrs) {
            filter.addAttributes(param.filter.attrs);
        }

        this.applyInitialFilter(filter);

        return filter;
    }, this);

    if (this.filters.length > 0) {
        this.tableAPI.on('init', this.onDataTableInit.bind(this));
    }
};

Filters.prototype = {

    /**
     * Array of filter constructor function. Each function
     * takes a setting object as its single parameter
     */
    builders: {},

    /**
     * Array of updater constructor function.
     * Each function takes the filter to update as its single parameter
     */
    updaters: {},

    /**
     * Array of default settings for the Filter object
     */
    defaultSettings: {
        updater: 'none'
    },

    /**
     * Refreshes filters after each ajax request
     *
     * @returns {Filters} The Filters object
     */
    registerAjaxListener: function () {
        this.tableAPI.on('xhr', function () {
            this.tableAPI.one('preDraw', this.refreshFilters.bind(this));
        }.bind(this));

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
     * @returns {Filters} The Filters object
     */
    setupHeaderRow: function () {
        var $filterHeader = $('<tr class="datatable-filters-header"></tr>');

        this.tableAPI.columns(':visible').header().each(function () {
            $filterHeader.append('<th></th>');
        });

        this.$header.append($filterHeader);

        return this;
    },

    /**
     * Redraws the datatable
     *
     * @returns {Filters} The Filters object
     */
    drawTable: function () {
        this.tableAPI.draw();

        return this;
    },

    /**
     * Retrieves the column data (current filter is ignored)
     *
     * @param {int} col The column index (0 based)
     *
     * @return {jQuery} The unfiltered column rendered data
     */
    getColumnData: function (col) {
        return this.tableAPI.column(col).data().unique();
    },

    /**
     * Retrieves the column filtered data
     *
     * @param {int} col The column index (0 based)
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
     * @returns {Filters} The Filters object
     */
    onDataTableInit: function () {
        this.setupHeaderRow().registerAjaxListener().renderFilters();

        return this;
    },

    /**
     * When a client-side filter changes, applies its new value
     *
     * @param {Event} event The event object
     * @param {Object} params The event params
     *
     * @return {Filters} The Filters object
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
     * @return {Filters} The Filters object
     */
    onServerFilterChange: function () {
        var serverQuery = this.filters.filter(function (filter) {
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
     * @param {BaseFilter} filter The filter object
     *
     * @return {Filters} The Filters object
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
     * @param {BaseFilter} filter The filter object
     *
     * @returns {Filters} The Filters object
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
     * @returns {Filters} The Filters object
     */
    renderFilters: function () {
        this.filters.forEach(this.renderFilter, this);

        return this;
    },

    /**
     * Asks a filter to render itself and provides an optional container
     * for filters that need to be rendered inside the datatable header row
     *
     * @param {BaseFilter} filter The filter object
     */
    renderFilter: function (filter) {
        var col = filter.column;
        var $colHeader = $(this.tableAPI.column(col).header());
        var $container = this.$header.find('.datatable-filters-header th:eq(' + filter.renderColumn + ')');

        if (filter.isServerSide()) {
            filter.register(this.onServerFilterChange.bind(this));
        } else {
            filter.register(this.onClientFilterChange.bind(this));
        }

        filter.render($container, $colHeader.html(), this.getColumnData(col));
    },

    /**
     * Refreshes the filters based on the currently displayed data for each column
     *
     * @return {Filters} The Filters object
     */
    refreshFilters: function () {
        this.filters.forEach(function (filter) {
            filter.refresh(this.getColumnData(filter.column));
            this.applyFilter(filter);
        }, this);

        this.drawTable();

        return this;
    }
};

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

Filters.prototype.builders.input = function (settings) {
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
'use strict';

var SimpleRenderer = {
    render: function ($container, header, data) {
        this.populate(data);
        this.showFilter(this.$dom, $container, header, data);

        return this;
    },

    showFilter: function($dom, $container, header) {
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
            if (value == this.allText || this._getNotSelected().length === 0) {
                return '';
            } else {
                return '^' + $.fn.dataTable.util.escapeRegex(value) + '$';
            }
        }, this).join('|');
    },

    /**
     * Filters the options before adding them to the select. Can be overridden
     * for specific filtering.
     * By default, use the value as option if `value` if a non empty string.
     *
     * @param {String} value The option value
     *
     * @returns {Boolean} True if the value can be included in the filter options. False otherwise.
     */
    filterOptions: function (value) {
        return value && value.trim() != '';
    },

    /**
     * Sort the options before adding them to the select. Can be overridden for
     * specific sorts
     *
     * @param {String} a The first value to compare
     * @param {String} b The second value to compare
     *
     * @return {Integer} 0 if the two values are equal, 1 if a > b and -1 if a < b
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
        return this.$dom.find('option:selected').toArray().map(function (option) {
            return option.value;
        });
    },

    /**
     *
     * @returns {*|Array} The array of non selected values
     * @private
     */
    _getNotSelected: function () {
        return this.$dom.find(':not(option:selected)').toArray().map(function (option) {
            return option.value;
        });
    },

    /**
     * For each element in the data object, creates an option element using the function
     * fnCreate
     *
     * @param {jQuery} data The data to add to the select
     * @param {Function} fnCreate The function to use to create the options
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
     * @param {String} value The option value
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
     * @param {String} value The option value
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
    _saveSelection: function () {
        this.selected = this._getSelection();
    },

    /**
     * Whenever the select state changes, save its new state and
     * notify the listening component
     *
     * @private
     */
    _onChange: function () {
        this._saveSelection();
        this.notifyChange();
    }
});

var availableRenderers = {
    'bootstrap': BootstrapRenderer,
    'chosen': ChosenRender
};

var builder = function (settings) {
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
     * @returns {FixedSelectFilter} The select filter
     */
    init: function () {
        this.$dom = $(this.src);
        this.$dom.on('change', this.notifyChange.bind(this));

        return this;
    },

    /**
     * No action for fixed filters: the provided select is used as is
     *
     * @returns {FixedSelectFilter} The Filter object
     */
    populate: function () {
        return this;
    },

    /**
     * No update for fixed filters: the provided select is never changed
     *
     * @returns {FixedSelectFilter} The Filter object
     */
    update: function () {
        return this;
    },

    /**
     * Fixed filters can be used to provide initial filters to apply to the
     * datatable.
     *
     * @returns {String} The Filter query
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
     * @returns {MultiSelectFilter} The Filter object
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
     * @param {Array<String>} data The column data
     *
     * @returns {MultiSelectFilter} The Filter object
     */
    populate: function (data) {
        this._addOptions(data, this._addSelectedOption);

        // Select each values returned by getInitialQuery
        var initialQuery = this.getInitialQuery();

        if (Array.isArray(initialQuery)) {
            initialQuery.forEach(function (initialQuery) {
                this.$dom.find('option[value="' + initialQuery + '"]').attr('selected', 'selected');
            }.bind(this));
        } else { // Assume initial query is a string
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
     * @param {Array<String>} data The column data
     *
     * @returns {MultiSelectFilter} The Filter object
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
     * @returns {String} The filter initial query
     */
    getInitialQuery: function () {
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
                if (nbSelected == 0) {
                    return header;
                }
                return header + ' (' + nbSelected + ')';
            }
        };

        this.$dom.multiselect($.extend(defaultOptions, this.rendererOptions));

        return this;
    },

    showFilter: function ($dom, $container) {
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
'use strict';

var ChosenRenderer = {
    render: function ($container, header, data) {
        this.populate(data);
        this.showFilter(this.$dom, $container, header, data);
        this.$dom.chosen(this.rendererOptions || {});

        return this;
    },

    showFilter: function($dom, $container) {
        $container.append(this.$dom);
    },

    refresh: function (data) {
        this.update(data);
        this.$dom.trigger('chosen:updated');

        return this;
    }
};

module.exports = ChosenRenderer;
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
     * @returns {SimpleSelectFilter} The Filter object
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
     * @param {Array<String>} data The column data
     *
     * @returns {SimpleSelectFilter} The filter object
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
     * @param {Array<String>} data The column data
     *
     * @returns {SimpleSelectFilter} The filter object
     */
    update: function (data) {
        this._addOptions(data, this._refreshOption);

        return this;
    },

    /**
     * This filter is dynamic, it can't be used for initial filtering
     *
     * @returns {String} The filter's initial query
     */
    getInitialQuery: function() {
        return '';
    }
});

Filters.prototype.builders.select = BaseSelect.builder.bind(SimpleSelectFilter);

module.exports = SimpleSelectFilter;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../filters":2,"./baseselect":6}],12:[function(require,module,exports){
'use strict';

var Filters = require('../filters');

/**
 * Dummy updater
 */
var UpdateNone = {
    refreshAllFilters: function () {
        return this;
    }
};

Filters.prototype.updaters.none = UpdateNone;

},{"../filters":2}],13:[function(require,module,exports){
'use strict';

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
        var filtersToRefresh = this.filters
            .filter(function (f) {
                return f.column !== filter.column;
            });


        filtersToRefresh.forEach(function (filter) {
            filter.refresh(this.getFilteredColumnData(filter.column));
        }, this);

        return this;
    }
};

Filters.prototype.updaters.others = UpdateOthers;

},{"../filters":2}]},{},[4])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJqcy9iYXNlZmlsdGVyLmpzIiwianMvZmlsdGVycy5qcyIsImpzL2lucHV0L2lucHV0LmpzIiwianMvbWFpbi5qcyIsImpzL3JlbmRlcmVyL3NpbXBsZS5qcyIsImpzL3NlbGVjdC9iYXNlc2VsZWN0LmpzIiwianMvc2VsZWN0L2ZpeGVkc2VsZWN0LmpzIiwianMvc2VsZWN0L211bHRpc2VsZWN0LmpzIiwianMvc2VsZWN0L3JlbmRlcmVyL2Jvb3RzdHJhcC5qcyIsImpzL3NlbGVjdC9yZW5kZXJlci9jaG9zZW4uanMiLCJqcy9zZWxlY3Qvc2ltcGxlc2VsZWN0LmpzIiwianMvdXBkYXRlci91cGRhdGVOb25lLmpzIiwianMvdXBkYXRlci91cGRhdGVPdGhlcnMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDdkZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNoUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNuREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDdEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQzdMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNuREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDOUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3ZCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDaEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxuLyoqXHJcbiAqIEJhc2VGaWx0ZXJcclxuICovXHJcbnZhciBCYXNlRmlsdGVyID0ge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQHJldHVybnMge0Jvb2xlYW59IFdoZXRoZXIgYSBmaWx0ZXIgY2hhbmdlIG11c3QgdHJpZ2dlciBhIGRhdGF0YWJsZSByZWxvYWQuXHJcbiAgICAgKiBEZWZhdWx0IGlzIGZhbHNlIChjbGllbnQgc2lkZSBmaWx0ZXIpLlxyXG4gICAgICovXHJcbiAgICBpc1NlcnZlclNpZGU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQHJldHVybnMge1N0cmluZ30gVGhlIHJlcXVlc3QgcGFyYW1ldGVyIGFzc29jaWF0ZWQgd2l0aCB0aGlzIGZpbHRlciAoaW4gdGhlIGZvcm0ga2V5PXBhcmFtLFxyXG4gICAgICogb25seSB1c2VkIGZvciBzZXJ2ZXIgc2lkZSBmaWx0ZXJzKVxyXG4gICAgICovXHJcbiAgICBnZXRTZXJ2ZXJRdWVyeTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiAnJztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUcmlnZ2VycyBhbiB1cGRhdGUgZXZlbnRcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7QmFzZUZpbHRlcn0gVGhlIGZpbHRlciBvYmplY3RcclxuICAgICAqL1xyXG4gICAgbm90aWZ5Q2hhbmdlOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdGhpcy4kZG9tLnRyaWdnZXIoJ3VwZGF0ZS5maWx0ZXJzLmR0Jywge1xyXG4gICAgICAgICAgICBmaWx0ZXI6IHRoaXNcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQHJldHVybnMge1N0cmluZ30gVGhlIGZpbHRlciBzdHJpbmcgdG8gYmUgYXBwbGllZCB0byB0aGUgZGF0YXRhYmxlIGNvbHVtblxyXG4gICAgICovXHJcbiAgICBnZXRRdWVyeTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIGlmICghdGhpcy5oYXNWYWx1ZSgpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm5vU2VsZWN0aW9uUXVlcnkoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzLnNlbGVjdGVkUXVlcnkoKTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZWdpc3RlcnMgYSBjYWxsYmFjayB0byBiZSBjYWxsZWQgd2hlbiB0aGUgdmFsdWUgb2YgdGhlIGZpbHRlciBjaGFuZ2VzXHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGFjdGlvbiB0byBwZXJmb3JtIHdoZW4gdGhlIGZpbHRlciB2YWx1ZSBjaGFuZ2VzXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge0Jhc2VGaWx0ZXJ9IFRoZSBmaWx0ZXIgb2JqZWN0XHJcbiAgICAgKi9cclxuICAgIHJlZ2lzdGVyOiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcclxuICAgICAgICB0aGlzLiRkb20ub24oJ3VwZGF0ZS5maWx0ZXJzLmR0JywgY2FsbGJhY2spO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBBZGRzIGEgY3NzIGNsYXNzIHRvIHRoZSBmaWx0ZXIgY29tcG9uZW50XHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGNzc0NsYXNzIFRoZSBjc3MgY2xhc3MgdG8gYWRkXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge0Jhc2VGaWx0ZXJ9IFRoZSBmaWx0ZXIgb2JqZWN0XHJcbiAgICAgKi9cclxuICAgIGFkZENsYXNzOiBmdW5jdGlvbiAoY3NzQ2xhc3MpIHtcclxuICAgICAgICB0aGlzLiRkb20uYWRkQ2xhc3MoY3NzQ2xhc3MpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBTZXRzIHRoZSBnaXZlbiB2YWx1ZXMgYXMgYXR0cmlidXRlcyBvZiB0aGUgZmlsdGVyIGNvbXBvbmVudFxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSB7QXJyYXl9IGF0dHJzIEFuIG9iamVjdCBvZiBhdHRyaWJ1dGUtdmFsdWUgcGFpcnMgdG8gc2V0XHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge0Jhc2VGaWx0ZXJ9IFRoZSBmaWx0ZXIgb2JqZWN0XHJcbiAgICAgKi9cclxuICAgIGFkZEF0dHJpYnV0ZXM6IGZ1bmN0aW9uIChhdHRycykge1xyXG4gICAgICAgIHRoaXMuJGRvbS5hdHRyKGF0dHJzKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEJhc2VGaWx0ZXI7IiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snJCddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnJCddIDogbnVsbCk7XHJcblxyXG4vKipcclxuICogRmlsdGVycyBpcyBhIGNvbXBvbmVudCB0aGF0IG1hbmFnZXMgYSBsaXN0IG9mIGZpbHRlciBvYmplY3RzIGluc2lkZVxyXG4gKiBhIGRhdGF0YWJsZSBoZWFkZXIgcm93LlxyXG4gKlxyXG4gKiBUaGlzIGNvbnN0cnVjdG9yIGJpbmRzIGxpc3RlbmVycyB0byB2YXJpb3VzIGRhdGF0YWJsZSBldmVudHMuXHJcbiAqXHJcbiAqIEBwYXJhbSB7T2JqZWN0fSBzZXR0aW5ncyBvYmplY3QgdXNlZCB0byBjcmVhdGUgdGhlIGRhdGF0YWJsZVxyXG4gKi9cclxudmFyIEZpbHRlcnMgPSBmdW5jdGlvbiAoc2V0dGluZ3MpIHtcclxuICAgIHRoaXMudGFibGVBUEkgPSBuZXcgJC5mbi5kYXRhVGFibGUuQXBpKHNldHRpbmdzKTtcclxuICAgIHRoaXMuJGhlYWRlciA9ICQodGhpcy50YWJsZUFQSS50YWJsZSgpLmhlYWRlcigpKTtcclxuICAgIHRoaXMudXJsID0gdGhpcy50YWJsZUFQSS5hamF4LnVybCgpO1xyXG5cclxuICAgIHRoaXMub3B0aW9ucyA9ICQuZXh0ZW5kKHt9LCB0aGlzLmRlZmF1bHRTZXR0aW5ncywgdGhpcy50YWJsZUFQSS5pbml0KCkuZmlsdGVycyk7XHJcbiAgICAkLmV4dGVuZCh0aGlzLCB0aGlzLnVwZGF0ZXJzW3RoaXMub3B0aW9ucy51cGRhdGVyXSk7XHJcblxyXG4gICAgdGhpcy5maWx0ZXJzID0gc2V0dGluZ3MuYW9Db2x1bW5zLmZpbHRlcihmdW5jdGlvbiAocGFyYW0pIHtcclxuICAgICAgICByZXR1cm4gcGFyYW0uZmlsdGVyICYmIHBhcmFtLmJWaXNpYmxlO1xyXG4gICAgfSkubWFwKGZ1bmN0aW9uIChwYXJhbSkge1xyXG4gICAgICAgIHZhciBvcHRpb25zID0gJC5leHRlbmQoe1xyXG4gICAgICAgICAgICBjb2x1bW46IHBhcmFtLmlkeCxcclxuICAgICAgICAgICAgcmVuZGVyQ29sdW1uOiB0aGlzLnRhYmxlQVBJLmNvbHVtbi5pbmRleCgndG9WaXNpYmxlJywgcGFyYW0uaWR4KVxyXG4gICAgICAgIH0sIHBhcmFtLmZpbHRlcik7XHJcblxyXG4gICAgICAgIHZhciBmaWx0ZXIgPSB0aGlzLmJ1aWxkZXJzW3BhcmFtLmZpbHRlci50eXBlXShvcHRpb25zKTtcclxuXHJcbiAgICAgICAgZmlsdGVyLmluaXQoKTtcclxuXHJcbiAgICAgICAgaWYgKHBhcmFtLmZpbHRlci5jbGFzc05hbWUpIHtcclxuICAgICAgICAgICAgZmlsdGVyLmFkZENsYXNzKHBhcmFtLmZpbHRlci5jbGFzc05hbWUpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHBhcmFtLmZpbHRlci5hdHRycykge1xyXG4gICAgICAgICAgICBmaWx0ZXIuYWRkQXR0cmlidXRlcyhwYXJhbS5maWx0ZXIuYXR0cnMpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5hcHBseUluaXRpYWxGaWx0ZXIoZmlsdGVyKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIGZpbHRlcjtcclxuICAgIH0sIHRoaXMpO1xyXG5cclxuICAgIGlmICh0aGlzLmZpbHRlcnMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIHRoaXMudGFibGVBUEkub24oJ2luaXQnLCB0aGlzLm9uRGF0YVRhYmxlSW5pdC5iaW5kKHRoaXMpKTtcclxuICAgIH1cclxufTtcclxuXHJcbkZpbHRlcnMucHJvdG90eXBlID0ge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQXJyYXkgb2YgZmlsdGVyIGNvbnN0cnVjdG9yIGZ1bmN0aW9uLiBFYWNoIGZ1bmN0aW9uXHJcbiAgICAgKiB0YWtlcyBhIHNldHRpbmcgb2JqZWN0IGFzIGl0cyBzaW5nbGUgcGFyYW1ldGVyXHJcbiAgICAgKi9cclxuICAgIGJ1aWxkZXJzOiB7fSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIEFycmF5IG9mIHVwZGF0ZXIgY29uc3RydWN0b3IgZnVuY3Rpb24uXHJcbiAgICAgKiBFYWNoIGZ1bmN0aW9uIHRha2VzIHRoZSBmaWx0ZXIgdG8gdXBkYXRlIGFzIGl0cyBzaW5nbGUgcGFyYW1ldGVyXHJcbiAgICAgKi9cclxuICAgIHVwZGF0ZXJzOiB7fSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIEFycmF5IG9mIGRlZmF1bHQgc2V0dGluZ3MgZm9yIHRoZSBGaWx0ZXIgb2JqZWN0XHJcbiAgICAgKi9cclxuICAgIGRlZmF1bHRTZXR0aW5nczoge1xyXG4gICAgICAgIHVwZGF0ZXI6ICdub25lJ1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIFJlZnJlc2hlcyBmaWx0ZXJzIGFmdGVyIGVhY2ggYWpheCByZXF1ZXN0XHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge0ZpbHRlcnN9IFRoZSBGaWx0ZXJzIG9iamVjdFxyXG4gICAgICovXHJcbiAgICByZWdpc3RlckFqYXhMaXN0ZW5lcjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMudGFibGVBUEkub24oJ3hocicsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdGhpcy50YWJsZUFQSS5vbmUoJ3ByZURyYXcnLCB0aGlzLnJlZnJlc2hGaWx0ZXJzLmJpbmQodGhpcykpO1xyXG4gICAgICAgIH0uYmluZCh0aGlzKSk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIEluaXRpYWxpemVzIHRoZSBoZWFkZXIgSFRNTCBlbGVtZW50cyB0aGF0IHdpbGwgYmUgdXNlZCB0byBob2xkIHRoZSBmaWx0ZXJzLlxyXG4gICAgICogSXQgYWxzbyByZWdpc3RlcnMgdGhlIG1haW4gZXZlbnQgaGFuZGxlciB0aGF0IHdpbGwgcmVhY3QgdG8gdGhlIGZpbHRlcnMnXHJcbiAgICAgKiB2YWx1ZSBjaGFuZ2VzLlxyXG4gICAgICpcclxuICAgICAqIFRoZSBldmVudCBuYW1lIGlzIDxiPmZpbHRlckNoYW5nZTwvYj4uIFRoaXMgZXZlbnQgbXVzdCBiZSB0cmlnZ2VyZWQgYnkgdGhlXHJcbiAgICAgKiBmaWx0ZXJzIHdoZW4gdGhlaXIgdmFsdWUgaXMgbW9kaWZpZWQgYnkgdGhlIHVzZXIgKG9yIGFueSBvdGhlciBldmVudCB0aGF0XHJcbiAgICAgKiBzaG91bGQgdHJpZ2dlciBhIGRhdGF0YWJsZSBmaWx0ZXIpLlxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJzfSBUaGUgRmlsdGVycyBvYmplY3RcclxuICAgICAqL1xyXG4gICAgc2V0dXBIZWFkZXJSb3c6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgJGZpbHRlckhlYWRlciA9ICQoJzx0ciBjbGFzcz1cImRhdGF0YWJsZS1maWx0ZXJzLWhlYWRlclwiPjwvdHI+Jyk7XHJcblxyXG4gICAgICAgIHRoaXMudGFibGVBUEkuY29sdW1ucygnOnZpc2libGUnKS5oZWFkZXIoKS5lYWNoKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgJGZpbHRlckhlYWRlci5hcHBlbmQoJzx0aD48L3RoPicpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB0aGlzLiRoZWFkZXIuYXBwZW5kKCRmaWx0ZXJIZWFkZXIpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZWRyYXdzIHRoZSBkYXRhdGFibGVcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7RmlsdGVyc30gVGhlIEZpbHRlcnMgb2JqZWN0XHJcbiAgICAgKi9cclxuICAgIGRyYXdUYWJsZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMudGFibGVBUEkuZHJhdygpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZXRyaWV2ZXMgdGhlIGNvbHVtbiBkYXRhIChjdXJyZW50IGZpbHRlciBpcyBpZ25vcmVkKVxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSB7aW50fSBjb2wgVGhlIGNvbHVtbiBpbmRleCAoMCBiYXNlZClcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJuIHtqUXVlcnl9IFRoZSB1bmZpbHRlcmVkIGNvbHVtbiByZW5kZXJlZCBkYXRhXHJcbiAgICAgKi9cclxuICAgIGdldENvbHVtbkRhdGE6IGZ1bmN0aW9uIChjb2wpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy50YWJsZUFQSS5jb2x1bW4oY29sKS5kYXRhKCkudW5pcXVlKCk7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmV0cmlldmVzIHRoZSBjb2x1bW4gZmlsdGVyZWQgZGF0YVxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSB7aW50fSBjb2wgVGhlIGNvbHVtbiBpbmRleCAoMCBiYXNlZClcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJuIHtqUXVlcnl9IFRoZSBmaWx0ZXJlZCBjb2x1bW4gZGF0YVxyXG4gICAgICovXHJcbiAgICBnZXRGaWx0ZXJlZENvbHVtbkRhdGE6IGZ1bmN0aW9uIChjb2wpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy50YWJsZUFQSS5jb2x1bW4oY29sLCB7c2VhcmNoOiAnYXBwbGllZCd9KS5kYXRhKCkudW5pcXVlKCk7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQWN0aW9ucyB0byBleGVjdXRlIHdoZW4gdGhlIGRhdGF0YWJsZSBpcyBkb25lIGluaXRpYWxpemluZy5cclxuICAgICAqIENyZWF0ZXMgdGhlIGZpbHRlciBoZWFkZXIgcm93LCByZWdpc3RlcnMgYWpheCBsaXN0ZW5lcnMgYW5kXHJcbiAgICAgKiByZW5kZXJzIGZpbHRlcnNcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7RmlsdGVyc30gVGhlIEZpbHRlcnMgb2JqZWN0XHJcbiAgICAgKi9cclxuICAgIG9uRGF0YVRhYmxlSW5pdDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMuc2V0dXBIZWFkZXJSb3coKS5yZWdpc3RlckFqYXhMaXN0ZW5lcigpLnJlbmRlckZpbHRlcnMoKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogV2hlbiBhIGNsaWVudC1zaWRlIGZpbHRlciBjaGFuZ2VzLCBhcHBsaWVzIGl0cyBuZXcgdmFsdWVcclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0ge0V2ZW50fSBldmVudCBUaGUgZXZlbnQgb2JqZWN0XHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gcGFyYW1zIFRoZSBldmVudCBwYXJhbXNcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJuIHtGaWx0ZXJzfSBUaGUgRmlsdGVycyBvYmplY3RcclxuICAgICAqL1xyXG4gICAgb25DbGllbnRGaWx0ZXJDaGFuZ2U6IGZ1bmN0aW9uIChldmVudCwgcGFyYW1zKSB7XHJcbiAgICAgICAgdGhpcy5hcHBseUZpbHRlcihwYXJhbXMuZmlsdGVyKVxyXG4gICAgICAgICAgICAucmVmcmVzaEFsbEZpbHRlcnMocGFyYW1zLmZpbHRlcilcclxuICAgICAgICAgICAgLmRyYXdUYWJsZSgpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBXaGVuIGEgc2VydmVyLXNpZGUgZmlsdGVyIGNoYW5nZXMsIGJ1aWxkcyB0aGUgbmV3IGFqYXggcXVlcnkgYW5kIHJlZnJlc2hlcyB0aGUgdGFibGVcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJuIHtGaWx0ZXJzfSBUaGUgRmlsdGVycyBvYmplY3RcclxuICAgICAqL1xyXG4gICAgb25TZXJ2ZXJGaWx0ZXJDaGFuZ2U6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB2YXIgc2VydmVyUXVlcnkgPSB0aGlzLmZpbHRlcnMuZmlsdGVyKGZ1bmN0aW9uIChmaWx0ZXIpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGZpbHRlci5pc1NlcnZlclNpZGUoKTtcclxuICAgICAgICB9KS5tYXAoZnVuY3Rpb24gKGZpbHRlcikge1xyXG4gICAgICAgICAgICByZXR1cm4gZmlsdGVyLmdldFNlcnZlclF1ZXJ5KCk7XHJcbiAgICAgICAgfSkuam9pbignJicpO1xyXG5cclxuICAgICAgICB0aGlzLnRhYmxlQVBJLmFqYXgudXJsKHRoaXMudXJsICsgJz8nICsgc2VydmVyUXVlcnkpLmFqYXgucmVsb2FkKCk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIEFwcGxpZXMgdGhlIGZpbHRlciB2YWx1ZSB0byB0aGUgcmVsYXRlZCBjb2x1bW5cclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0ge0Jhc2VGaWx0ZXJ9IGZpbHRlciBUaGUgZmlsdGVyIG9iamVjdFxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm4ge0ZpbHRlcnN9IFRoZSBGaWx0ZXJzIG9iamVjdFxyXG4gICAgICovXHJcbiAgICBhcHBseUZpbHRlcjogZnVuY3Rpb24gKGZpbHRlcikge1xyXG4gICAgICAgIHRoaXMudGFibGVBUEkuY29sdW1uKGZpbHRlci5jb2x1bW4pLnNlYXJjaChcclxuICAgICAgICAgICAgZmlsdGVyLmdldFF1ZXJ5KCksXHJcbiAgICAgICAgICAgIGZpbHRlci5pc1JlZ2V4TWF0Y2goKVxyXG4gICAgICAgICAgICAsIGZhbHNlKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRW5hYmxlcyBmaWx0ZXJzIHRvIGFwcGx5IGFuIGluaXRpYWwgY29sdW1uIGZpbHRlciwgYmVmb3JlXHJcbiAgICAgKiBhbnkgZGF0YSBwcm9jZXNzaW5nL2Rpc3BsYXlpbmcgaXMgZG9uZS5cclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0ge0Jhc2VGaWx0ZXJ9IGZpbHRlciBUaGUgZmlsdGVyIG9iamVjdFxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJzfSBUaGUgRmlsdGVycyBvYmplY3RcclxuICAgICAqL1xyXG4gICAgYXBwbHlJbml0aWFsRmlsdGVyOiBmdW5jdGlvbiAoZmlsdGVyKSB7XHJcbiAgICAgICAgdGhpcy50YWJsZUFQSS5jb2x1bW4oZmlsdGVyLmNvbHVtbikuc2VhcmNoKFxyXG4gICAgICAgICAgICBmaWx0ZXIuZ2V0SW5pdGlhbFF1ZXJ5KCksXHJcbiAgICAgICAgICAgIGZpbHRlci5pc1JlZ2V4TWF0Y2goKVxyXG4gICAgICAgICAgICAsIGZhbHNlKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQHNlZSB0aGlzLnJlbmRlckZpbHRlclxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJzfSBUaGUgRmlsdGVycyBvYmplY3RcclxuICAgICAqL1xyXG4gICAgcmVuZGVyRmlsdGVyczogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMuZmlsdGVycy5mb3JFYWNoKHRoaXMucmVuZGVyRmlsdGVyLCB0aGlzKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQXNrcyBhIGZpbHRlciB0byByZW5kZXIgaXRzZWxmIGFuZCBwcm92aWRlcyBhbiBvcHRpb25hbCBjb250YWluZXJcclxuICAgICAqIGZvciBmaWx0ZXJzIHRoYXQgbmVlZCB0byBiZSByZW5kZXJlZCBpbnNpZGUgdGhlIGRhdGF0YWJsZSBoZWFkZXIgcm93XHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtIHtCYXNlRmlsdGVyfSBmaWx0ZXIgVGhlIGZpbHRlciBvYmplY3RcclxuICAgICAqL1xyXG4gICAgcmVuZGVyRmlsdGVyOiBmdW5jdGlvbiAoZmlsdGVyKSB7XHJcbiAgICAgICAgdmFyIGNvbCA9IGZpbHRlci5jb2x1bW47XHJcbiAgICAgICAgdmFyICRjb2xIZWFkZXIgPSAkKHRoaXMudGFibGVBUEkuY29sdW1uKGNvbCkuaGVhZGVyKCkpO1xyXG4gICAgICAgIHZhciAkY29udGFpbmVyID0gdGhpcy4kaGVhZGVyLmZpbmQoJy5kYXRhdGFibGUtZmlsdGVycy1oZWFkZXIgdGg6ZXEoJyArIGZpbHRlci5yZW5kZXJDb2x1bW4gKyAnKScpO1xyXG5cclxuICAgICAgICBpZiAoZmlsdGVyLmlzU2VydmVyU2lkZSgpKSB7XHJcbiAgICAgICAgICAgIGZpbHRlci5yZWdpc3Rlcih0aGlzLm9uU2VydmVyRmlsdGVyQ2hhbmdlLmJpbmQodGhpcykpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGZpbHRlci5yZWdpc3Rlcih0aGlzLm9uQ2xpZW50RmlsdGVyQ2hhbmdlLmJpbmQodGhpcykpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZmlsdGVyLnJlbmRlcigkY29udGFpbmVyLCAkY29sSGVhZGVyLmh0bWwoKSwgdGhpcy5nZXRDb2x1bW5EYXRhKGNvbCkpO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIFJlZnJlc2hlcyB0aGUgZmlsdGVycyBiYXNlZCBvbiB0aGUgY3VycmVudGx5IGRpc3BsYXllZCBkYXRhIGZvciBlYWNoIGNvbHVtblxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm4ge0ZpbHRlcnN9IFRoZSBGaWx0ZXJzIG9iamVjdFxyXG4gICAgICovXHJcbiAgICByZWZyZXNoRmlsdGVyczogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMuZmlsdGVycy5mb3JFYWNoKGZ1bmN0aW9uIChmaWx0ZXIpIHtcclxuICAgICAgICAgICAgZmlsdGVyLnJlZnJlc2godGhpcy5nZXRDb2x1bW5EYXRhKGZpbHRlci5jb2x1bW4pKTtcclxuICAgICAgICAgICAgdGhpcy5hcHBseUZpbHRlcihmaWx0ZXIpO1xyXG4gICAgICAgIH0sIHRoaXMpO1xyXG5cclxuICAgICAgICB0aGlzLmRyYXdUYWJsZSgpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxufTtcclxuXHJcbiQoZG9jdW1lbnQpLm9uKCdwcmVJbml0LmR0JywgZnVuY3Rpb24gKGUsIHNldHRpbmdzKSB7XHJcbiAgICBuZXcgRmlsdGVycyhzZXR0aW5ncyk7XHJcbn0pO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBGaWx0ZXJzO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgJCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WyckJ10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWyckJ10gOiBudWxsKTtcclxudmFyIEJhc2VGaWx0ZXIgPSByZXF1aXJlKCcuLi9iYXNlZmlsdGVyJyk7XHJcbnZhciBTaW1wbGVSZW5kZXJlciA9IHJlcXVpcmUoJy4uL3JlbmRlcmVyL3NpbXBsZScpO1xyXG52YXIgRmlsdGVycyA9IHJlcXVpcmUoJy4uL2ZpbHRlcnMnKTtcclxuXHJcbnZhciBJbnB1dEZpbHRlciA9ICQuZXh0ZW5kKHt9LCBCYXNlRmlsdGVyLCBTaW1wbGVSZW5kZXJlciwge1xyXG5cclxuICAgIGluaXQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLiRkb20gPSAkKCc8aW5wdXQgY2xhc3M9XCJmaWx0cmVcIi8+Jyk7XHJcbiAgICAgICAgdGhpcy4kZG9tLnZhbCh0aGlzLmdldEluaXRpYWxRdWVyeSgpKTtcclxuICAgICAgICB0aGlzLiRkb20ub24oJ2lucHV0JywgdGhpcy5ub3RpZnlDaGFuZ2UuYmluZCh0aGlzKSk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICBwb3B1bGF0ZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICB1cGRhdGU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgbm9TZWxlY3Rpb25RdWVyeTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiAnJztcclxuICAgIH0sXHJcblxyXG4gICAgaXNSZWdleE1hdGNoOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9LFxyXG5cclxuICAgIGhhc1ZhbHVlOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuJGRvbS52YWwoKSAhPSAnJztcclxuICAgIH0sXHJcblxyXG4gICAgc2VsZWN0ZWRRdWVyeTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLiRkb20udmFsKCk7XHJcbiAgICB9LFxyXG5cclxuICAgIGdldEluaXRpYWxRdWVyeTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiAnJztcclxuICAgIH1cclxufSk7XHJcblxyXG5GaWx0ZXJzLnByb3RvdHlwZS5idWlsZGVycy5pbnB1dCA9IGZ1bmN0aW9uIChzZXR0aW5ncykge1xyXG4gICAgcmV0dXJuICQuZXh0ZW5kKHt9LCBJbnB1dEZpbHRlciwgc2V0dGluZ3MpO1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBJbnB1dEZpbHRlcjtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxucmVxdWlyZSgnLi91cGRhdGVyL3VwZGF0ZU5vbmUnKTtcclxucmVxdWlyZSgnLi91cGRhdGVyL3VwZGF0ZU90aGVycycpO1xyXG5yZXF1aXJlKCcuL3NlbGVjdC9zaW1wbGVzZWxlY3QnKTtcclxucmVxdWlyZSgnLi9zZWxlY3QvbXVsdGlzZWxlY3QnKTtcclxucmVxdWlyZSgnLi9zZWxlY3QvZml4ZWRzZWxlY3QnKTtcclxucmVxdWlyZSgnLi9pbnB1dC9pbnB1dCcpO1xyXG5yZXF1aXJlKCcuL2ZpbHRlcnMnKTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIFNpbXBsZVJlbmRlcmVyID0ge1xyXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoJGNvbnRhaW5lciwgaGVhZGVyLCBkYXRhKSB7XHJcbiAgICAgICAgdGhpcy5wb3B1bGF0ZShkYXRhKTtcclxuICAgICAgICB0aGlzLnNob3dGaWx0ZXIodGhpcy4kZG9tLCAkY29udGFpbmVyLCBoZWFkZXIsIGRhdGEpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgc2hvd0ZpbHRlcjogZnVuY3Rpb24oJGRvbSwgJGNvbnRhaW5lciwgaGVhZGVyKSB7XHJcbiAgICAgICAgJGNvbnRhaW5lci5hcHBlbmQodGhpcy4kZG9tKTtcclxuICAgICAgICB0aGlzLiRkb20uYXR0cignbmFtZScsIGhlYWRlcikuYXR0cigncGxhY2Vob2xkZXInLCBoZWFkZXIpLnNob3coKTtcclxuICAgIH0sXHJcblxyXG4gICAgcmVmcmVzaDogZnVuY3Rpb24gKGRhdGEpIHtcclxuICAgICAgICB0aGlzLnVwZGF0ZShkYXRhKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFNpbXBsZVJlbmRlcmVyOyIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJyQnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJyQnXSA6IG51bGwpO1xyXG52YXIgQmFzZUZpbHRlciA9IHJlcXVpcmUoJy4uL2Jhc2VmaWx0ZXInKTtcclxudmFyIFNpbXBsZVJlbmRlcmVyID0gcmVxdWlyZSgnLi4vcmVuZGVyZXIvc2ltcGxlJyk7XHJcbnZhciBCb290c3RyYXBSZW5kZXJlciA9IHJlcXVpcmUoJy4vcmVuZGVyZXIvYm9vdHN0cmFwJyk7XHJcbnZhciBDaG9zZW5SZW5kZXIgPSByZXF1aXJlKCcuL3JlbmRlcmVyL2Nob3NlbicpO1xyXG5cclxuLyoqXHJcbiAqIFNlbGVjdEZpbHRlciByZWdyb3VwcyBjb21tb24gYmVoYXZpb3IgZm9yIHNlbGVjdCBmaWx0ZXJzXHJcbiAqL1xyXG52YXIgU2VsZWN0RmlsdGVyID0gJC5leHRlbmQoe30sIEJhc2VGaWx0ZXIsIHtcclxuICAgIHNlbGVjdGVkOiBbXSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgYW4gYWx3YXlzIGZhbHNlIHJlZ2V4IHRvIGhpZGUgZXZlcnkgcmVjb3Jkc1xyXG4gICAgICogd2hlbiBubyBvcHRpb24gaXMgc2VsZWN0ZWRcclxuICAgICAqL1xyXG4gICAgbm9TZWxlY3Rpb25RdWVyeTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiAnJC5eJztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZS4gU2VsZWN0IGZpbHRlcnMgYWx3YXlzIHVzZSByZWdleFxyXG4gICAgICovXHJcbiAgICBpc1JlZ2V4TWF0Y2g6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyB0cnVlIGlmIGF0IGxlYXN0IG9uZSBvcHRpb24gaXMgc2VsZWN0ZWRcclxuICAgICAqL1xyXG4gICAgaGFzVmFsdWU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fZ2V0U2VsZWN0aW9uKCkubGVuZ3RoID4gMDtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgY29sdW1uIGZpbHRlciBxdWVyeSB0byBhcHBseS4gU2VsZWN0ZWQgb3B0aW9uIHZhbHVlc1xyXG4gICAgICogYXJlIGNvbmNhdGVuYXRlZCBpbnRvIGEgc3RyaW5nIHVzaW5nIHRoZSBwaXBlIGNoYXJhY3RlciAocmVnZXggb3IpXHJcbiAgICAgKi9cclxuICAgIHNlbGVjdGVkUXVlcnk6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fZ2V0U2VsZWN0aW9uKCkubWFwKGZ1bmN0aW9uICh2YWx1ZSkge1xyXG4gICAgICAgICAgICBpZiAodmFsdWUgPT0gdGhpcy5hbGxUZXh0IHx8IHRoaXMuX2dldE5vdFNlbGVjdGVkKCkubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gJyc7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gJ14nICsgJC5mbi5kYXRhVGFibGUudXRpbC5lc2NhcGVSZWdleCh2YWx1ZSkgKyAnJCc7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LCB0aGlzKS5qb2luKCd8Jyk7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRmlsdGVycyB0aGUgb3B0aW9ucyBiZWZvcmUgYWRkaW5nIHRoZW0gdG8gdGhlIHNlbGVjdC4gQ2FuIGJlIG92ZXJyaWRkZW5cclxuICAgICAqIGZvciBzcGVjaWZpYyBmaWx0ZXJpbmcuXHJcbiAgICAgKiBCeSBkZWZhdWx0LCB1c2UgdGhlIHZhbHVlIGFzIG9wdGlvbiBpZiBgdmFsdWVgIGlmIGEgbm9uIGVtcHR5IHN0cmluZy5cclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gdmFsdWUgVGhlIG9wdGlvbiB2YWx1ZVxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtCb29sZWFufSBUcnVlIGlmIHRoZSB2YWx1ZSBjYW4gYmUgaW5jbHVkZWQgaW4gdGhlIGZpbHRlciBvcHRpb25zLiBGYWxzZSBvdGhlcndpc2UuXHJcbiAgICAgKi9cclxuICAgIGZpbHRlck9wdGlvbnM6IGZ1bmN0aW9uICh2YWx1ZSkge1xyXG4gICAgICAgIHJldHVybiB2YWx1ZSAmJiB2YWx1ZS50cmltKCkgIT0gJyc7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogU29ydCB0aGUgb3B0aW9ucyBiZWZvcmUgYWRkaW5nIHRoZW0gdG8gdGhlIHNlbGVjdC4gQ2FuIGJlIG92ZXJyaWRkZW4gZm9yXHJcbiAgICAgKiBzcGVjaWZpYyBzb3J0c1xyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBhIFRoZSBmaXJzdCB2YWx1ZSB0byBjb21wYXJlXHJcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gYiBUaGUgc2Vjb25kIHZhbHVlIHRvIGNvbXBhcmVcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJuIHtJbnRlZ2VyfSAwIGlmIHRoZSB0d28gdmFsdWVzIGFyZSBlcXVhbCwgMSBpZiBhID4gYiBhbmQgLTEgaWYgYSA8IGJcclxuICAgICAqL1xyXG4gICAgc29ydE9wdGlvbnM6IGZ1bmN0aW9uIChhLCBiKSB7XHJcbiAgICAgICAgaWYgKGEgPiBiKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAxO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGEgPCBiKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAtMTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiAwO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIEByZXR1cm5zIHtBcnJheTxTdHJpbmc+fSBUaGUgYXJyYXkgb2Ygc2VsZWN0ZWQgdmFsdWVzXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICovXHJcbiAgICBfZ2V0U2VsZWN0aW9uOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuJGRvbS5maW5kKCdvcHRpb246c2VsZWN0ZWQnKS50b0FycmF5KCkubWFwKGZ1bmN0aW9uIChvcHRpb24pIHtcclxuICAgICAgICAgICAgcmV0dXJuIG9wdGlvbi52YWx1ZTtcclxuICAgICAgICB9KTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMgeyp8QXJyYXl9IFRoZSBhcnJheSBvZiBub24gc2VsZWN0ZWQgdmFsdWVzXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICovXHJcbiAgICBfZ2V0Tm90U2VsZWN0ZWQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy4kZG9tLmZpbmQoJzpub3Qob3B0aW9uOnNlbGVjdGVkKScpLnRvQXJyYXkoKS5tYXAoZnVuY3Rpb24gKG9wdGlvbikge1xyXG4gICAgICAgICAgICByZXR1cm4gb3B0aW9uLnZhbHVlO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIEZvciBlYWNoIGVsZW1lbnQgaW4gdGhlIGRhdGEgb2JqZWN0LCBjcmVhdGVzIGFuIG9wdGlvbiBlbGVtZW50IHVzaW5nIHRoZSBmdW5jdGlvblxyXG4gICAgICogZm5DcmVhdGVcclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0ge2pRdWVyeX0gZGF0YSBUaGUgZGF0YSB0byBhZGQgdG8gdGhlIHNlbGVjdFxyXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gZm5DcmVhdGUgVGhlIGZ1bmN0aW9uIHRvIHVzZSB0byBjcmVhdGUgdGhlIG9wdGlvbnNcclxuICAgICAqIEBwcml2YXRlXHJcbiAgICAgKi9cclxuICAgIF9hZGRPcHRpb25zOiBmdW5jdGlvbiAoZGF0YSwgZm5DcmVhdGUpIHtcclxuICAgICAgICB0aGlzLiRkb20uZW1wdHkoKTtcclxuXHJcbiAgICAgICAgaWYgKHRoaXMuYWxsVGV4dClcclxuICAgICAgICAgICAgZm5DcmVhdGUuY2FsbCh0aGlzLCB0aGlzLmFsbFRleHQpO1xyXG5cclxuICAgICAgICBkYXRhLnRvQXJyYXkoKS5maWx0ZXIodGhpcy5maWx0ZXJPcHRpb25zKS5zb3J0KHRoaXMuc29ydE9wdGlvbnMpLmZvckVhY2goZm5DcmVhdGUsIHRoaXMpO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZXMgYSBzZWxlY3RlZCBvcHRpb25cclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gdmFsdWUgVGhlIG9wdGlvbiB2YWx1ZVxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqL1xyXG4gICAgX2FkZFNlbGVjdGVkT3B0aW9uOiBmdW5jdGlvbiAodmFsdWUpIHtcclxuICAgICAgICB0aGlzLiRkb20uYXBwZW5kKCQoJzxvcHRpb24vPicpXHJcbiAgICAgICAgICAgICAgICAudmFsKHZhbHVlKVxyXG4gICAgICAgICAgICAgICAgLnRleHQodmFsdWUpXHJcbiAgICAgICAgICAgICAgICAuYXR0cignc2VsZWN0ZWQnLCAnc2VsZWN0ZWQnKVxyXG4gICAgICAgICk7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhbiBvcHRpb24gd2l0aCB0aGUgc2VsZWN0ZWQgZmxhZyBiYXNlZCBvbiB0aGVcclxuICAgICAqIGN1cnJlbnQgZmlsdGVyIHN0YXRlXHJcbiAgICAgKlxyXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHZhbHVlIFRoZSBvcHRpb24gdmFsdWVcclxuICAgICAqIEBwcml2YXRlXHJcbiAgICAgKi9cclxuICAgIF9yZWZyZXNoT3B0aW9uOiBmdW5jdGlvbiAodmFsdWUpIHtcclxuICAgICAgICB2YXIgJG9wdGlvbiA9ICQoJzxvcHRpb24vPicpXHJcbiAgICAgICAgICAgIC52YWwodmFsdWUpXHJcbiAgICAgICAgICAgIC50ZXh0KHZhbHVlKTtcclxuXHJcbiAgICAgICAgaWYgKCQuaW5BcnJheSh2YWx1ZSwgdGhpcy5zZWxlY3RlZCkgPiAtMSlcclxuICAgICAgICAgICAgJG9wdGlvbi5hdHRyKCdzZWxlY3RlZCcsICdzZWxlY3RlZCcpO1xyXG5cclxuICAgICAgICB0aGlzLiRkb20uYXBwZW5kKCRvcHRpb24pO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIFRha2VzIGEgc25hcHNob3Qgb2YgdGhlIGN1cnJlbnQgc2VsZWN0aW9uIHN0YXRlXHJcbiAgICAgKlxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqL1xyXG4gICAgX3NhdmVTZWxlY3Rpb246IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLnNlbGVjdGVkID0gdGhpcy5fZ2V0U2VsZWN0aW9uKCk7XHJcbiAgICB9LFxyXG5cclxuICAgIC8qKlxyXG4gICAgICogV2hlbmV2ZXIgdGhlIHNlbGVjdCBzdGF0ZSBjaGFuZ2VzLCBzYXZlIGl0cyBuZXcgc3RhdGUgYW5kXHJcbiAgICAgKiBub3RpZnkgdGhlIGxpc3RlbmluZyBjb21wb25lbnRcclxuICAgICAqXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICovXHJcbiAgICBfb25DaGFuZ2U6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLl9zYXZlU2VsZWN0aW9uKCk7XHJcbiAgICAgICAgdGhpcy5ub3RpZnlDaGFuZ2UoKTtcclxuICAgIH1cclxufSk7XHJcblxyXG52YXIgYXZhaWxhYmxlUmVuZGVyZXJzID0ge1xyXG4gICAgJ2Jvb3RzdHJhcCc6IEJvb3RzdHJhcFJlbmRlcmVyLFxyXG4gICAgJ2Nob3Nlbic6IENob3NlblJlbmRlclxyXG59O1xyXG5cclxudmFyIGJ1aWxkZXIgPSBmdW5jdGlvbiAoc2V0dGluZ3MpIHtcclxuICAgIHZhciByZW5kZXJlciA9IGF2YWlsYWJsZVJlbmRlcmVyc1tzZXR0aW5ncy5yZW5kZXJlcl0gfHwgU2ltcGxlUmVuZGVyZXI7XHJcblxyXG4gICAgcmV0dXJuICQuZXh0ZW5kKHt9LCB0aGlzLCByZW5kZXJlciwgc2V0dGluZ3MpO1xyXG59O1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBTZWxlY3RGaWx0ZXI6IFNlbGVjdEZpbHRlcixcclxuICAgIGJ1aWxkZXI6IGJ1aWxkZXJcclxufTsiLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgJCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WyckJ10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWyckJ10gOiBudWxsKTtcclxudmFyIEZpbHRlcnMgPSByZXF1aXJlKCcuLi9maWx0ZXJzJyk7XHJcbnZhciBCYXNlU2VsZWN0ID0gcmVxdWlyZSgnLi9iYXNlc2VsZWN0Jyk7XHJcblxyXG52YXIgRml4ZWRTZWxlY3RGaWx0ZXIgPSAkLmV4dGVuZCh7fSwgQmFzZVNlbGVjdC5TZWxlY3RGaWx0ZXIsIHtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFNpbXBseSBzYXZlcyBhIGhhbmRsZSBvbiB0aGUgcHJvdmlkZWQgc291cmNlIHNlbGVjdFxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtGaXhlZFNlbGVjdEZpbHRlcn0gVGhlIHNlbGVjdCBmaWx0ZXJcclxuICAgICAqL1xyXG4gICAgaW5pdDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMuJGRvbSA9ICQodGhpcy5zcmMpO1xyXG4gICAgICAgIHRoaXMuJGRvbS5vbignY2hhbmdlJywgdGhpcy5ub3RpZnlDaGFuZ2UuYmluZCh0aGlzKSk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIE5vIGFjdGlvbiBmb3IgZml4ZWQgZmlsdGVyczogdGhlIHByb3ZpZGVkIHNlbGVjdCBpcyB1c2VkIGFzIGlzXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge0ZpeGVkU2VsZWN0RmlsdGVyfSBUaGUgRmlsdGVyIG9iamVjdFxyXG4gICAgICovXHJcbiAgICBwb3B1bGF0ZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIE5vIHVwZGF0ZSBmb3IgZml4ZWQgZmlsdGVyczogdGhlIHByb3ZpZGVkIHNlbGVjdCBpcyBuZXZlciBjaGFuZ2VkXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge0ZpeGVkU2VsZWN0RmlsdGVyfSBUaGUgRmlsdGVyIG9iamVjdFxyXG4gICAgICovXHJcbiAgICB1cGRhdGU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBGaXhlZCBmaWx0ZXJzIGNhbiBiZSB1c2VkIHRvIHByb3ZpZGUgaW5pdGlhbCBmaWx0ZXJzIHRvIGFwcGx5IHRvIHRoZVxyXG4gICAgICogZGF0YXRhYmxlLlxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBGaWx0ZXIgcXVlcnlcclxuICAgICAqL1xyXG4gICAgZ2V0SW5pdGlhbFF1ZXJ5OiBmdW5jdGlvbigpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5nZXRRdWVyeSgpO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbkZpbHRlcnMucHJvdG90eXBlLmJ1aWxkZXJzLmZpeGVkc2VsZWN0ID0gQmFzZVNlbGVjdC5idWlsZGVyLmJpbmQoRml4ZWRTZWxlY3RGaWx0ZXIpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBGaXhlZFNlbGVjdEZpbHRlcjsiLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgJCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WyckJ10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWyckJ10gOiBudWxsKTtcclxudmFyIEZpbHRlcnMgPSByZXF1aXJlKCcuLi9maWx0ZXJzJyk7XHJcbnZhciBCYXNlU2VsZWN0ID0gcmVxdWlyZSgnLi9iYXNlc2VsZWN0Jyk7XHJcblxyXG52YXIgTXVsdGlTZWxlY3RGaWx0ZXIgPSAkLmV4dGVuZCh7fSwgQmFzZVNlbGVjdC5TZWxlY3RGaWx0ZXIsIHtcclxuXHJcbiAgICAvKipcclxuICAgICAqIEluaXRpYWxpemVzIGEgbXVsdGlzZWxlY3QgZG9tIG9iamVjdFxyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtNdWx0aVNlbGVjdEZpbHRlcn0gVGhlIEZpbHRlciBvYmplY3RcclxuICAgICAqL1xyXG4gICAgaW5pdDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMuJGRvbSA9ICQoJzxzZWxlY3QgY2xhc3M9XCJmaWx0cmVcIi8+JykuYXR0cignbXVsdGlwbGUnLCAnbXVsdGlwbGUnKTtcclxuICAgICAgICB0aGlzLiRkb20ub24oJ2NoYW5nZScsIHRoaXMuX29uQ2hhbmdlLmJpbmQodGhpcykpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBQb3B1bGF0ZXMgdGhlIG11bHRpc2VsZWN0IHdpdGggJ3NlbGVjdGVkJyBvcHRpb25zIGJ5IGRlZmF1bHRcclxuICAgICAqIFVzZXMgZ2V0SW5pdGlhbFF1ZXJ5IGFzIGRlZmF1bHQgdmFsdWUocylcclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0ge0FycmF5PFN0cmluZz59IGRhdGEgVGhlIGNvbHVtbiBkYXRhXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge011bHRpU2VsZWN0RmlsdGVyfSBUaGUgRmlsdGVyIG9iamVjdFxyXG4gICAgICovXHJcbiAgICBwb3B1bGF0ZTogZnVuY3Rpb24gKGRhdGEpIHtcclxuICAgICAgICB0aGlzLl9hZGRPcHRpb25zKGRhdGEsIHRoaXMuX2FkZFNlbGVjdGVkT3B0aW9uKTtcclxuXHJcbiAgICAgICAgLy8gU2VsZWN0IGVhY2ggdmFsdWVzIHJldHVybmVkIGJ5IGdldEluaXRpYWxRdWVyeVxyXG4gICAgICAgIHZhciBpbml0aWFsUXVlcnkgPSB0aGlzLmdldEluaXRpYWxRdWVyeSgpO1xyXG5cclxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShpbml0aWFsUXVlcnkpKSB7XHJcbiAgICAgICAgICAgIGluaXRpYWxRdWVyeS5mb3JFYWNoKGZ1bmN0aW9uIChpbml0aWFsUXVlcnkpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuJGRvbS5maW5kKCdvcHRpb25bdmFsdWU9XCInICsgaW5pdGlhbFF1ZXJ5ICsgJ1wiXScpLmF0dHIoJ3NlbGVjdGVkJywgJ3NlbGVjdGVkJyk7XHJcbiAgICAgICAgICAgIH0uYmluZCh0aGlzKSk7XHJcbiAgICAgICAgfSBlbHNlIHsgLy8gQXNzdW1lIGluaXRpYWwgcXVlcnkgaXMgYSBzdHJpbmdcclxuICAgICAgICAgICAgdGhpcy4kZG9tLmZpbmQoJ29wdGlvblt2YWx1ZT1cIicgKyBpbml0aWFsUXVlcnkgKyAnXCJdJykuYXR0cignc2VsZWN0ZWQnLCAnc2VsZWN0ZWQnKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMuX3NhdmVTZWxlY3Rpb24oKTtcclxuICAgICAgICB0aGlzLl9vbkNoYW5nZSgpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBJZiB0aGUgJ2FsbCcgb3B0aW9uIGlzIHNlbGVjdGVkLCBzZXRzIHRoZSBuZXcgb3B0aW9ucyBhcyAnc2VsZWN0ZWQnLlxyXG4gICAgICogT3RoZXJ3aXNlLCBhZGRzIHRoZSBvcHRpb25zIGJhc2VkIG9uIHRoZSBmaWx0ZXIgc3RhdGVcclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0ge0FycmF5PFN0cmluZz59IGRhdGEgVGhlIGNvbHVtbiBkYXRhXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge011bHRpU2VsZWN0RmlsdGVyfSBUaGUgRmlsdGVyIG9iamVjdFxyXG4gICAgICovXHJcbiAgICB1cGRhdGU6IGZ1bmN0aW9uIChkYXRhKSB7XHJcbiAgICAgICAgaWYgKCQuaW5BcnJheSh0aGlzLmFsbFRleHQsIHRoaXMuc2VsZWN0ZWQpID4gLTEgfHwgdGhpcy5fZ2V0Tm90U2VsZWN0ZWQoKS5sZW5ndGggPT0gMClcclxuICAgICAgICAgICAgdGhpcy5fYWRkT3B0aW9ucyhkYXRhLCB0aGlzLl9hZGRTZWxlY3RlZE9wdGlvbik7XHJcbiAgICAgICAgZWxzZVxyXG4gICAgICAgICAgICB0aGlzLl9hZGRPcHRpb25zKGRhdGEsIHRoaXMuX3JlZnJlc2hPcHRpb24pO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUaGlzIGZpbHRlciBpcyBkeW5hbWljLCBpdCBjYW4ndCBiZSB1c2VkIGZvciBpbml0aWFsIGZpbHRlcmluZ1xyXG4gICAgICpcclxuICAgICAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBmaWx0ZXIgaW5pdGlhbCBxdWVyeVxyXG4gICAgICovXHJcbiAgICBnZXRJbml0aWFsUXVlcnk6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gJyc7XHJcbiAgICB9XHJcbn0pO1xyXG5cclxuRmlsdGVycy5wcm90b3R5cGUuYnVpbGRlcnMubXVsdGlzZWxlY3QgPSBCYXNlU2VsZWN0LmJ1aWxkZXIuYmluZChNdWx0aVNlbGVjdEZpbHRlcik7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IE11bHRpU2VsZWN0RmlsdGVyO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcbnZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJyQnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJyQnXSA6IG51bGwpO1xyXG5cclxudmFyIEJvb3RzdHJhcFJlbmRlcmVyID0ge1xyXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoJGNvbnRhaW5lciwgaGVhZGVyLCBkYXRhKSB7XHJcbiAgICAgICAgdGhpcy5wb3B1bGF0ZShkYXRhKTtcclxuICAgICAgICB0aGlzLnNob3dGaWx0ZXIodGhpcy4kZG9tLCAkY29udGFpbmVyLCBoZWFkZXIsIGRhdGEpO1xyXG5cclxuICAgICAgICB2YXIgZGVmYXVsdE9wdGlvbnMgPSB7XHJcbiAgICAgICAgICAgIGJ1dHRvblRleHQ6IGZ1bmN0aW9uIChvcHRpb25zKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgbmJTZWxlY3RlZCA9ICQob3B0aW9ucykuZmlsdGVyKCc6c2VsZWN0ZWQnKS5sZW5ndGg7XHJcbiAgICAgICAgICAgICAgICBpZiAobmJTZWxlY3RlZCA9PSAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGhlYWRlcjtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiBoZWFkZXIgKyAnICgnICsgbmJTZWxlY3RlZCArICcpJztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHRoaXMuJGRvbS5tdWx0aXNlbGVjdCgkLmV4dGVuZChkZWZhdWx0T3B0aW9ucywgdGhpcy5yZW5kZXJlck9wdGlvbnMpKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIHNob3dGaWx0ZXI6IGZ1bmN0aW9uICgkZG9tLCAkY29udGFpbmVyKSB7XHJcbiAgICAgICAgJGNvbnRhaW5lci5hcHBlbmQodGhpcy4kZG9tKTtcclxuICAgIH0sXHJcblxyXG4gICAgcmVmcmVzaDogZnVuY3Rpb24gKGRhdGEpIHtcclxuICAgICAgICB0aGlzLnVwZGF0ZShkYXRhKTtcclxuICAgICAgICB0aGlzLiRkb20ubXVsdGlzZWxlY3QoJ3JlYnVpbGQnKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEJvb3RzdHJhcFJlbmRlcmVyOyIsIid1c2Ugc3RyaWN0JztcclxuXHJcbnZhciBDaG9zZW5SZW5kZXJlciA9IHtcclxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCRjb250YWluZXIsIGhlYWRlciwgZGF0YSkge1xyXG4gICAgICAgIHRoaXMucG9wdWxhdGUoZGF0YSk7XHJcbiAgICAgICAgdGhpcy5zaG93RmlsdGVyKHRoaXMuJGRvbSwgJGNvbnRhaW5lciwgaGVhZGVyLCBkYXRhKTtcclxuICAgICAgICB0aGlzLiRkb20uY2hvc2VuKHRoaXMucmVuZGVyZXJPcHRpb25zIHx8IHt9KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9LFxyXG5cclxuICAgIHNob3dGaWx0ZXI6IGZ1bmN0aW9uKCRkb20sICRjb250YWluZXIpIHtcclxuICAgICAgICAkY29udGFpbmVyLmFwcGVuZCh0aGlzLiRkb20pO1xyXG4gICAgfSxcclxuXHJcbiAgICByZWZyZXNoOiBmdW5jdGlvbiAoZGF0YSkge1xyXG4gICAgICAgIHRoaXMudXBkYXRlKGRhdGEpO1xyXG4gICAgICAgIHRoaXMuJGRvbS50cmlnZ2VyKCdjaG9zZW46dXBkYXRlZCcpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxufTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gQ2hvc2VuUmVuZGVyZXI7IiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snJCddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnJCddIDogbnVsbCk7XHJcbnZhciBGaWx0ZXJzID0gcmVxdWlyZSgnLi4vZmlsdGVycycpO1xyXG52YXIgQmFzZVNlbGVjdCA9IHJlcXVpcmUoJy4vYmFzZXNlbGVjdCcpO1xyXG5cclxudmFyIFNpbXBsZVNlbGVjdEZpbHRlciA9ICQuZXh0ZW5kKHt9LCBCYXNlU2VsZWN0LlNlbGVjdEZpbHRlciwge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlcyBhIHNpbXBsZSBzZWxlY3RcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7U2ltcGxlU2VsZWN0RmlsdGVyfSBUaGUgRmlsdGVyIG9iamVjdFxyXG4gICAgICovXHJcbiAgICBpbml0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdGhpcy4kZG9tID0gJCgnPHNlbGVjdCBjbGFzcz1cImZpbHRyZVwiLz4nKTtcclxuICAgICAgICB0aGlzLiRkb20ub24oJ2NoYW5nZScsIHRoaXMuX29uQ2hhbmdlLmJpbmQodGhpcykpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBBZGRzIGFsbCBvcHRpb25zIHdpdGhvdXQgc3BlY2lmeWluZyB0aGUgJ3NlbGVjdGVkJyBmbGFnXHJcbiAgICAgKiBJZiBhbiBvcHRpb24gd2l0aCBgZ2V0SW5pdGlhbFF1ZXJ5YCB2YWx1ZSBleGlzdHMsIHNlbGVjdHMgaXQsXHJcbiAgICAgKiBvdGhlcndpc2UsIHRoZSBmaXJzdCBvcHRpb24gaXMgc2VsZWN0ZWQgYnkgZGVmYXVsdFxyXG4gICAgICpcclxuICAgICAqIEBwYXJhbSB7QXJyYXk8U3RyaW5nPn0gZGF0YSBUaGUgY29sdW1uIGRhdGFcclxuICAgICAqXHJcbiAgICAgKiBAcmV0dXJucyB7U2ltcGxlU2VsZWN0RmlsdGVyfSBUaGUgZmlsdGVyIG9iamVjdFxyXG4gICAgICovXHJcbiAgICBwb3B1bGF0ZTogZnVuY3Rpb24gKGRhdGEpIHtcclxuICAgICAgICB0aGlzLl9hZGRPcHRpb25zKGRhdGEsIHRoaXMuX3JlZnJlc2hPcHRpb24pO1xyXG4gICAgICAgIHRoaXMuJGRvbS5maW5kKCdvcHRpb25bdmFsdWU9XCInICsgdGhpcy5nZXRJbml0aWFsUXVlcnkoKSArICdcIl0nKS5hdHRyKCdzZWxlY3RlZCcsICdzZWxlY3RlZCcpO1xyXG4gICAgICAgIHRoaXMuX3NhdmVTZWxlY3Rpb24oKTtcclxuICAgICAgICB0aGlzLl9vbkNoYW5nZSgpO1xyXG5cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZWZyZXNoIHRoZSBvcHRpb25zIGJhc2VkIG9uIHRoZSBmaWx0ZXIgc3RhdGVcclxuICAgICAqXHJcbiAgICAgKiBAcGFyYW0ge0FycmF5PFN0cmluZz59IGRhdGEgVGhlIGNvbHVtbiBkYXRhXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge1NpbXBsZVNlbGVjdEZpbHRlcn0gVGhlIGZpbHRlciBvYmplY3RcclxuICAgICAqL1xyXG4gICAgdXBkYXRlOiBmdW5jdGlvbiAoZGF0YSkge1xyXG4gICAgICAgIHRoaXMuX2FkZE9wdGlvbnMoZGF0YSwgdGhpcy5fcmVmcmVzaE9wdGlvbik7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfSxcclxuXHJcbiAgICAvKipcclxuICAgICAqIFRoaXMgZmlsdGVyIGlzIGR5bmFtaWMsIGl0IGNhbid0IGJlIHVzZWQgZm9yIGluaXRpYWwgZmlsdGVyaW5nXHJcbiAgICAgKlxyXG4gICAgICogQHJldHVybnMge1N0cmluZ30gVGhlIGZpbHRlcidzIGluaXRpYWwgcXVlcnlcclxuICAgICAqL1xyXG4gICAgZ2V0SW5pdGlhbFF1ZXJ5OiBmdW5jdGlvbigpIHtcclxuICAgICAgICByZXR1cm4gJyc7XHJcbiAgICB9XHJcbn0pO1xyXG5cclxuRmlsdGVycy5wcm90b3R5cGUuYnVpbGRlcnMuc2VsZWN0ID0gQmFzZVNlbGVjdC5idWlsZGVyLmJpbmQoU2ltcGxlU2VsZWN0RmlsdGVyKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gU2ltcGxlU2VsZWN0RmlsdGVyO1xyXG4iLCIndXNlIHN0cmljdCc7XHJcblxyXG52YXIgRmlsdGVycyA9IHJlcXVpcmUoJy4uL2ZpbHRlcnMnKTtcclxuXHJcbi8qKlxyXG4gKiBEdW1teSB1cGRhdGVyXHJcbiAqL1xyXG52YXIgVXBkYXRlTm9uZSA9IHtcclxuICAgIHJlZnJlc2hBbGxGaWx0ZXJzOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcbn07XHJcblxyXG5GaWx0ZXJzLnByb3RvdHlwZS51cGRhdGVycy5ub25lID0gVXBkYXRlTm9uZTtcclxuIiwiJ3VzZSBzdHJpY3QnO1xyXG5cclxudmFyIEZpbHRlcnMgPSByZXF1aXJlKCcuLi9maWx0ZXJzJyk7XHJcblxyXG4vKipcclxuICogRWFjaCB0aW1lIGEgZmlsdGVyIGNoYW5nZWQsXHJcbiAqIHJlZnJlc2ggdGhlIG90aGVycyBmaWx0ZXJzLlxyXG4gKi9cclxudmFyIFVwZGF0ZU90aGVycyA9IHtcclxuXHJcbiAgICByZWZyZXNoQWxsRmlsdGVyczogZnVuY3Rpb24gKGZpbHRlcikge1xyXG4gICAgICAgIC8vIHJlZnJlc2ggYWxsIGZpbHRlcnNcclxuICAgICAgICAvLyBleGNlcHQgdGhlIGNoYW5nZWQgb25lLFxyXG4gICAgICAgIC8vIHVubGVzcyB0aGUgZmlsdGVyIGlzIHJlc2V0dGVkLlxyXG4gICAgICAgIHZhciBmaWx0ZXJzVG9SZWZyZXNoID0gdGhpcy5maWx0ZXJzXHJcbiAgICAgICAgICAgIC5maWx0ZXIoZnVuY3Rpb24gKGYpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmLmNvbHVtbiAhPT0gZmlsdGVyLmNvbHVtbjtcclxuICAgICAgICAgICAgfSk7XHJcblxyXG5cclxuICAgICAgICBmaWx0ZXJzVG9SZWZyZXNoLmZvckVhY2goZnVuY3Rpb24gKGZpbHRlcikge1xyXG4gICAgICAgICAgICBmaWx0ZXIucmVmcmVzaCh0aGlzLmdldEZpbHRlcmVkQ29sdW1uRGF0YShmaWx0ZXIuY29sdW1uKSk7XHJcbiAgICAgICAgfSwgdGhpcyk7XHJcblxyXG4gICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgfVxyXG59O1xyXG5cclxuRmlsdGVycy5wcm90b3R5cGUudXBkYXRlcnMub3RoZXJzID0gVXBkYXRlT3RoZXJzO1xyXG4iXX0=
