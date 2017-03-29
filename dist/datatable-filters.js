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
        var $filterHeader = $('<tr class="datatable-filters-header filters"></tr>');

        this.tableAPI.columns(':visible').header().each(function () {
            $filterHeader.append('<th class="fond-header"></th>');
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJqcy9iYXNlZmlsdGVyLmpzIiwianMvZmlsdGVycy5qcyIsImpzL2lucHV0L2lucHV0LmpzIiwianMvbWFpbi5qcyIsImpzL3JlbmRlcmVyL3NpbXBsZS5qcyIsImpzL3NlbGVjdC9iYXNlc2VsZWN0LmpzIiwianMvc2VsZWN0L2ZpeGVkc2VsZWN0LmpzIiwianMvc2VsZWN0L211bHRpc2VsZWN0LmpzIiwianMvc2VsZWN0L3JlbmRlcmVyL2Jvb3RzdHJhcC5qcyIsImpzL3NlbGVjdC9yZW5kZXJlci9jaG9zZW4uanMiLCJqcy9zZWxlY3Qvc2ltcGxlc2VsZWN0LmpzIiwianMvdXBkYXRlci91cGRhdGVOb25lLmpzIiwianMvdXBkYXRlci91cGRhdGVPdGhlcnMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDdkZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNoUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNuREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDdEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQzdMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNuREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDOUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3ZCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDaEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIEJhc2VGaWx0ZXJcbiAqL1xudmFyIEJhc2VGaWx0ZXIgPSB7XG5cbiAgICAvKipcbiAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gV2hldGhlciBhIGZpbHRlciBjaGFuZ2UgbXVzdCB0cmlnZ2VyIGEgZGF0YXRhYmxlIHJlbG9hZC5cbiAgICAgKiBEZWZhdWx0IGlzIGZhbHNlIChjbGllbnQgc2lkZSBmaWx0ZXIpLlxuICAgICAqL1xuICAgIGlzU2VydmVyU2lkZTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSByZXF1ZXN0IHBhcmFtZXRlciBhc3NvY2lhdGVkIHdpdGggdGhpcyBmaWx0ZXIgKGluIHRoZSBmb3JtIGtleT1wYXJhbSxcbiAgICAgKiBvbmx5IHVzZWQgZm9yIHNlcnZlciBzaWRlIGZpbHRlcnMpXG4gICAgICovXG4gICAgZ2V0U2VydmVyUXVlcnk6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuICcnO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBUcmlnZ2VycyBhbiB1cGRhdGUgZXZlbnRcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtCYXNlRmlsdGVyfSBUaGUgZmlsdGVyIG9iamVjdFxuICAgICAqL1xuICAgIG5vdGlmeUNoYW5nZTogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLiRkb20udHJpZ2dlcigndXBkYXRlLmZpbHRlcnMuZHQnLCB7XG4gICAgICAgICAgICBmaWx0ZXI6IHRoaXNcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBmaWx0ZXIgc3RyaW5nIHRvIGJlIGFwcGxpZWQgdG8gdGhlIGRhdGF0YWJsZSBjb2x1bW5cbiAgICAgKi9cbiAgICBnZXRRdWVyeTogZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoIXRoaXMuaGFzVmFsdWUoKSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubm9TZWxlY3Rpb25RdWVyeSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuc2VsZWN0ZWRRdWVyeSgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZWdpc3RlcnMgYSBjYWxsYmFjayB0byBiZSBjYWxsZWQgd2hlbiB0aGUgdmFsdWUgb2YgdGhlIGZpbHRlciBjaGFuZ2VzXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgYWN0aW9uIHRvIHBlcmZvcm0gd2hlbiB0aGUgZmlsdGVyIHZhbHVlIGNoYW5nZXNcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtCYXNlRmlsdGVyfSBUaGUgZmlsdGVyIG9iamVjdFxuICAgICAqL1xuICAgIHJlZ2lzdGVyOiBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgICAgdGhpcy4kZG9tLm9uKCd1cGRhdGUuZmlsdGVycy5kdCcsIGNhbGxiYWNrKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQWRkcyBhIGNzcyBjbGFzcyB0byB0aGUgZmlsdGVyIGNvbXBvbmVudFxuICAgICAqXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGNzc0NsYXNzIFRoZSBjc3MgY2xhc3MgdG8gYWRkXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7QmFzZUZpbHRlcn0gVGhlIGZpbHRlciBvYmplY3RcbiAgICAgKi9cbiAgICBhZGRDbGFzczogZnVuY3Rpb24gKGNzc0NsYXNzKSB7XG4gICAgICAgIHRoaXMuJGRvbS5hZGRDbGFzcyhjc3NDbGFzcyk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIGdpdmVuIHZhbHVlcyBhcyBhdHRyaWJ1dGVzIG9mIHRoZSBmaWx0ZXIgY29tcG9uZW50XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBhdHRycyBBbiBvYmplY3Qgb2YgYXR0cmlidXRlLXZhbHVlIHBhaXJzIHRvIHNldFxuICAgICAqXG4gICAgICogQHJldHVybnMge0Jhc2VGaWx0ZXJ9IFRoZSBmaWx0ZXIgb2JqZWN0XG4gICAgICovXG4gICAgYWRkQXR0cmlidXRlczogZnVuY3Rpb24gKGF0dHJzKSB7XG4gICAgICAgIHRoaXMuJGRvbS5hdHRyKGF0dHJzKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEJhc2VGaWx0ZXI7IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgJCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WyckJ10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWyckJ10gOiBudWxsKTtcblxuLyoqXG4gKiBGaWx0ZXJzIGlzIGEgY29tcG9uZW50IHRoYXQgbWFuYWdlcyBhIGxpc3Qgb2YgZmlsdGVyIG9iamVjdHMgaW5zaWRlXG4gKiBhIGRhdGF0YWJsZSBoZWFkZXIgcm93LlxuICpcbiAqIFRoaXMgY29uc3RydWN0b3IgYmluZHMgbGlzdGVuZXJzIHRvIHZhcmlvdXMgZGF0YXRhYmxlIGV2ZW50cy5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gc2V0dGluZ3Mgb2JqZWN0IHVzZWQgdG8gY3JlYXRlIHRoZSBkYXRhdGFibGVcbiAqL1xudmFyIEZpbHRlcnMgPSBmdW5jdGlvbiAoc2V0dGluZ3MpIHtcbiAgICB0aGlzLnRhYmxlQVBJID0gbmV3ICQuZm4uZGF0YVRhYmxlLkFwaShzZXR0aW5ncyk7XG4gICAgdGhpcy4kaGVhZGVyID0gJCh0aGlzLnRhYmxlQVBJLnRhYmxlKCkuaGVhZGVyKCkpO1xuICAgIHRoaXMudXJsID0gdGhpcy50YWJsZUFQSS5hamF4LnVybCgpO1xuXG4gICAgdGhpcy5vcHRpb25zID0gJC5leHRlbmQoe30sIHRoaXMuZGVmYXVsdFNldHRpbmdzLCB0aGlzLnRhYmxlQVBJLmluaXQoKS5maWx0ZXJzKTtcbiAgICAkLmV4dGVuZCh0aGlzLCB0aGlzLnVwZGF0ZXJzW3RoaXMub3B0aW9ucy51cGRhdGVyXSk7XG5cbiAgICB0aGlzLmZpbHRlcnMgPSBzZXR0aW5ncy5hb0NvbHVtbnMuZmlsdGVyKGZ1bmN0aW9uIChwYXJhbSkge1xuICAgICAgICByZXR1cm4gcGFyYW0uZmlsdGVyICYmIHBhcmFtLmJWaXNpYmxlO1xuICAgIH0pLm1hcChmdW5jdGlvbiAocGFyYW0pIHtcbiAgICAgICAgdmFyIG9wdGlvbnMgPSAkLmV4dGVuZCh7XG4gICAgICAgICAgICBjb2x1bW46IHBhcmFtLmlkeCxcbiAgICAgICAgICAgIHJlbmRlckNvbHVtbjogdGhpcy50YWJsZUFQSS5jb2x1bW4uaW5kZXgoJ3RvVmlzaWJsZScsIHBhcmFtLmlkeClcbiAgICAgICAgfSwgcGFyYW0uZmlsdGVyKTtcblxuICAgICAgICB2YXIgZmlsdGVyID0gdGhpcy5idWlsZGVyc1twYXJhbS5maWx0ZXIudHlwZV0ob3B0aW9ucyk7XG5cbiAgICAgICAgZmlsdGVyLmluaXQoKTtcblxuICAgICAgICBpZiAocGFyYW0uZmlsdGVyLmNsYXNzTmFtZSkge1xuICAgICAgICAgICAgZmlsdGVyLmFkZENsYXNzKHBhcmFtLmZpbHRlci5jbGFzc05hbWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHBhcmFtLmZpbHRlci5hdHRycykge1xuICAgICAgICAgICAgZmlsdGVyLmFkZEF0dHJpYnV0ZXMocGFyYW0uZmlsdGVyLmF0dHJzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuYXBwbHlJbml0aWFsRmlsdGVyKGZpbHRlcik7XG5cbiAgICAgICAgcmV0dXJuIGZpbHRlcjtcbiAgICB9LCB0aGlzKTtcblxuICAgIGlmICh0aGlzLmZpbHRlcnMubGVuZ3RoID4gMCkge1xuICAgICAgICB0aGlzLnRhYmxlQVBJLm9uKCdpbml0JywgdGhpcy5vbkRhdGFUYWJsZUluaXQuYmluZCh0aGlzKSk7XG4gICAgfVxufTtcblxuRmlsdGVycy5wcm90b3R5cGUgPSB7XG5cbiAgICAvKipcbiAgICAgKiBBcnJheSBvZiBmaWx0ZXIgY29uc3RydWN0b3IgZnVuY3Rpb24uIEVhY2ggZnVuY3Rpb25cbiAgICAgKiB0YWtlcyBhIHNldHRpbmcgb2JqZWN0IGFzIGl0cyBzaW5nbGUgcGFyYW1ldGVyXG4gICAgICovXG4gICAgYnVpbGRlcnM6IHt9LFxuXG4gICAgLyoqXG4gICAgICogQXJyYXkgb2YgdXBkYXRlciBjb25zdHJ1Y3RvciBmdW5jdGlvbi5cbiAgICAgKiBFYWNoIGZ1bmN0aW9uIHRha2VzIHRoZSBmaWx0ZXIgdG8gdXBkYXRlIGFzIGl0cyBzaW5nbGUgcGFyYW1ldGVyXG4gICAgICovXG4gICAgdXBkYXRlcnM6IHt9LFxuXG4gICAgLyoqXG4gICAgICogQXJyYXkgb2YgZGVmYXVsdCBzZXR0aW5ncyBmb3IgdGhlIEZpbHRlciBvYmplY3RcbiAgICAgKi9cbiAgICBkZWZhdWx0U2V0dGluZ3M6IHtcbiAgICAgICAgdXBkYXRlcjogJ25vbmUnXG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJlZnJlc2hlcyBmaWx0ZXJzIGFmdGVyIGVhY2ggYWpheCByZXF1ZXN0XG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7RmlsdGVyc30gVGhlIEZpbHRlcnMgb2JqZWN0XG4gICAgICovXG4gICAgcmVnaXN0ZXJBamF4TGlzdGVuZXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy50YWJsZUFQSS5vbigneGhyJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy50YWJsZUFQSS5vbmUoJ3ByZURyYXcnLCB0aGlzLnJlZnJlc2hGaWx0ZXJzLmJpbmQodGhpcykpO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBJbml0aWFsaXplcyB0aGUgaGVhZGVyIEhUTUwgZWxlbWVudHMgdGhhdCB3aWxsIGJlIHVzZWQgdG8gaG9sZCB0aGUgZmlsdGVycy5cbiAgICAgKiBJdCBhbHNvIHJlZ2lzdGVycyB0aGUgbWFpbiBldmVudCBoYW5kbGVyIHRoYXQgd2lsbCByZWFjdCB0byB0aGUgZmlsdGVycydcbiAgICAgKiB2YWx1ZSBjaGFuZ2VzLlxuICAgICAqXG4gICAgICogVGhlIGV2ZW50IG5hbWUgaXMgPGI+ZmlsdGVyQ2hhbmdlPC9iPi4gVGhpcyBldmVudCBtdXN0IGJlIHRyaWdnZXJlZCBieSB0aGVcbiAgICAgKiBmaWx0ZXJzIHdoZW4gdGhlaXIgdmFsdWUgaXMgbW9kaWZpZWQgYnkgdGhlIHVzZXIgKG9yIGFueSBvdGhlciBldmVudCB0aGF0XG4gICAgICogc2hvdWxkIHRyaWdnZXIgYSBkYXRhdGFibGUgZmlsdGVyKS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJzfSBUaGUgRmlsdGVycyBvYmplY3RcbiAgICAgKi9cbiAgICBzZXR1cEhlYWRlclJvdzogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgJGZpbHRlckhlYWRlciA9ICQoJzx0ciBjbGFzcz1cImRhdGF0YWJsZS1maWx0ZXJzLWhlYWRlciBmaWx0ZXJzXCI+PC90cj4nKTtcblxuICAgICAgICB0aGlzLnRhYmxlQVBJLmNvbHVtbnMoJzp2aXNpYmxlJykuaGVhZGVyKCkuZWFjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAkZmlsdGVySGVhZGVyLmFwcGVuZCgnPHRoIGNsYXNzPVwiZm9uZC1oZWFkZXJcIj48L3RoPicpO1xuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLiRoZWFkZXIuYXBwZW5kKCRmaWx0ZXJIZWFkZXIpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZWRyYXdzIHRoZSBkYXRhdGFibGVcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJzfSBUaGUgRmlsdGVycyBvYmplY3RcbiAgICAgKi9cbiAgICBkcmF3VGFibGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy50YWJsZUFQSS5kcmF3KCk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHJpZXZlcyB0aGUgY29sdW1uIGRhdGEgKGN1cnJlbnQgZmlsdGVyIGlzIGlnbm9yZWQpXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2ludH0gY29sIFRoZSBjb2x1bW4gaW5kZXggKDAgYmFzZWQpXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtqUXVlcnl9IFRoZSB1bmZpbHRlcmVkIGNvbHVtbiByZW5kZXJlZCBkYXRhXG4gICAgICovXG4gICAgZ2V0Q29sdW1uRGF0YTogZnVuY3Rpb24gKGNvbCkge1xuICAgICAgICByZXR1cm4gdGhpcy50YWJsZUFQSS5jb2x1bW4oY29sKS5kYXRhKCkudW5pcXVlKCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHJpZXZlcyB0aGUgY29sdW1uIGZpbHRlcmVkIGRhdGFcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7aW50fSBjb2wgVGhlIGNvbHVtbiBpbmRleCAoMCBiYXNlZClcbiAgICAgKlxuICAgICAqIEByZXR1cm4ge2pRdWVyeX0gVGhlIGZpbHRlcmVkIGNvbHVtbiBkYXRhXG4gICAgICovXG4gICAgZ2V0RmlsdGVyZWRDb2x1bW5EYXRhOiBmdW5jdGlvbiAoY29sKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRhYmxlQVBJLmNvbHVtbihjb2wsIHtzZWFyY2g6ICdhcHBsaWVkJ30pLmRhdGEoKS51bmlxdWUoKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQWN0aW9ucyB0byBleGVjdXRlIHdoZW4gdGhlIGRhdGF0YWJsZSBpcyBkb25lIGluaXRpYWxpemluZy5cbiAgICAgKiBDcmVhdGVzIHRoZSBmaWx0ZXIgaGVhZGVyIHJvdywgcmVnaXN0ZXJzIGFqYXggbGlzdGVuZXJzIGFuZFxuICAgICAqIHJlbmRlcnMgZmlsdGVyc1xuICAgICAqXG4gICAgICogQHJldHVybnMge0ZpbHRlcnN9IFRoZSBGaWx0ZXJzIG9iamVjdFxuICAgICAqL1xuICAgIG9uRGF0YVRhYmxlSW5pdDogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnNldHVwSGVhZGVyUm93KCkucmVnaXN0ZXJBamF4TGlzdGVuZXIoKS5yZW5kZXJGaWx0ZXJzKCk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFdoZW4gYSBjbGllbnQtc2lkZSBmaWx0ZXIgY2hhbmdlcywgYXBwbGllcyBpdHMgbmV3IHZhbHVlXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0V2ZW50fSBldmVudCBUaGUgZXZlbnQgb2JqZWN0XG4gICAgICogQHBhcmFtIHtPYmplY3R9IHBhcmFtcyBUaGUgZXZlbnQgcGFyYW1zXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtGaWx0ZXJzfSBUaGUgRmlsdGVycyBvYmplY3RcbiAgICAgKi9cbiAgICBvbkNsaWVudEZpbHRlckNoYW5nZTogZnVuY3Rpb24gKGV2ZW50LCBwYXJhbXMpIHtcbiAgICAgICAgdGhpcy5hcHBseUZpbHRlcihwYXJhbXMuZmlsdGVyKVxuICAgICAgICAgICAgLnJlZnJlc2hBbGxGaWx0ZXJzKHBhcmFtcy5maWx0ZXIpXG4gICAgICAgICAgICAuZHJhd1RhYmxlKCk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFdoZW4gYSBzZXJ2ZXItc2lkZSBmaWx0ZXIgY2hhbmdlcywgYnVpbGRzIHRoZSBuZXcgYWpheCBxdWVyeSBhbmQgcmVmcmVzaGVzIHRoZSB0YWJsZVxuICAgICAqXG4gICAgICogQHJldHVybiB7RmlsdGVyc30gVGhlIEZpbHRlcnMgb2JqZWN0XG4gICAgICovXG4gICAgb25TZXJ2ZXJGaWx0ZXJDaGFuZ2U6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHNlcnZlclF1ZXJ5ID0gdGhpcy5maWx0ZXJzLmZpbHRlcihmdW5jdGlvbiAoZmlsdGVyKSB7XG4gICAgICAgICAgICByZXR1cm4gZmlsdGVyLmlzU2VydmVyU2lkZSgpO1xuICAgICAgICB9KS5tYXAoZnVuY3Rpb24gKGZpbHRlcikge1xuICAgICAgICAgICAgcmV0dXJuIGZpbHRlci5nZXRTZXJ2ZXJRdWVyeSgpO1xuICAgICAgICB9KS5qb2luKCcmJyk7XG5cbiAgICAgICAgdGhpcy50YWJsZUFQSS5hamF4LnVybCh0aGlzLnVybCArICc/JyArIHNlcnZlclF1ZXJ5KS5hamF4LnJlbG9hZCgpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBcHBsaWVzIHRoZSBmaWx0ZXIgdmFsdWUgdG8gdGhlIHJlbGF0ZWQgY29sdW1uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0Jhc2VGaWx0ZXJ9IGZpbHRlciBUaGUgZmlsdGVyIG9iamVjdFxuICAgICAqXG4gICAgICogQHJldHVybiB7RmlsdGVyc30gVGhlIEZpbHRlcnMgb2JqZWN0XG4gICAgICovXG4gICAgYXBwbHlGaWx0ZXI6IGZ1bmN0aW9uIChmaWx0ZXIpIHtcbiAgICAgICAgdGhpcy50YWJsZUFQSS5jb2x1bW4oZmlsdGVyLmNvbHVtbikuc2VhcmNoKFxuICAgICAgICAgICAgZmlsdGVyLmdldFF1ZXJ5KCksXG4gICAgICAgICAgICBmaWx0ZXIuaXNSZWdleE1hdGNoKClcbiAgICAgICAgICAgICwgZmFsc2UpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBFbmFibGVzIGZpbHRlcnMgdG8gYXBwbHkgYW4gaW5pdGlhbCBjb2x1bW4gZmlsdGVyLCBiZWZvcmVcbiAgICAgKiBhbnkgZGF0YSBwcm9jZXNzaW5nL2Rpc3BsYXlpbmcgaXMgZG9uZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7QmFzZUZpbHRlcn0gZmlsdGVyIFRoZSBmaWx0ZXIgb2JqZWN0XG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7RmlsdGVyc30gVGhlIEZpbHRlcnMgb2JqZWN0XG4gICAgICovXG4gICAgYXBwbHlJbml0aWFsRmlsdGVyOiBmdW5jdGlvbiAoZmlsdGVyKSB7XG4gICAgICAgIHRoaXMudGFibGVBUEkuY29sdW1uKGZpbHRlci5jb2x1bW4pLnNlYXJjaChcbiAgICAgICAgICAgIGZpbHRlci5nZXRJbml0aWFsUXVlcnkoKSxcbiAgICAgICAgICAgIGZpbHRlci5pc1JlZ2V4TWF0Y2goKVxuICAgICAgICAgICAgLCBmYWxzZSk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBzZWUgdGhpcy5yZW5kZXJGaWx0ZXJcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtGaWx0ZXJzfSBUaGUgRmlsdGVycyBvYmplY3RcbiAgICAgKi9cbiAgICByZW5kZXJGaWx0ZXJzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuZmlsdGVycy5mb3JFYWNoKHRoaXMucmVuZGVyRmlsdGVyLCB0aGlzKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQXNrcyBhIGZpbHRlciB0byByZW5kZXIgaXRzZWxmIGFuZCBwcm92aWRlcyBhbiBvcHRpb25hbCBjb250YWluZXJcbiAgICAgKiBmb3IgZmlsdGVycyB0aGF0IG5lZWQgdG8gYmUgcmVuZGVyZWQgaW5zaWRlIHRoZSBkYXRhdGFibGUgaGVhZGVyIHJvd1xuICAgICAqXG4gICAgICogQHBhcmFtIHtCYXNlRmlsdGVyfSBmaWx0ZXIgVGhlIGZpbHRlciBvYmplY3RcbiAgICAgKi9cbiAgICByZW5kZXJGaWx0ZXI6IGZ1bmN0aW9uIChmaWx0ZXIpIHtcbiAgICAgICAgdmFyIGNvbCA9IGZpbHRlci5jb2x1bW47XG4gICAgICAgIHZhciAkY29sSGVhZGVyID0gJCh0aGlzLnRhYmxlQVBJLmNvbHVtbihjb2wpLmhlYWRlcigpKTtcbiAgICAgICAgdmFyICRjb250YWluZXIgPSB0aGlzLiRoZWFkZXIuZmluZCgnLmRhdGF0YWJsZS1maWx0ZXJzLWhlYWRlciB0aDplcSgnICsgZmlsdGVyLnJlbmRlckNvbHVtbiArICcpJyk7XG5cbiAgICAgICAgaWYgKGZpbHRlci5pc1NlcnZlclNpZGUoKSkge1xuICAgICAgICAgICAgZmlsdGVyLnJlZ2lzdGVyKHRoaXMub25TZXJ2ZXJGaWx0ZXJDaGFuZ2UuYmluZCh0aGlzKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmaWx0ZXIucmVnaXN0ZXIodGhpcy5vbkNsaWVudEZpbHRlckNoYW5nZS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZpbHRlci5yZW5kZXIoJGNvbnRhaW5lciwgJGNvbEhlYWRlci5odG1sKCksIHRoaXMuZ2V0Q29sdW1uRGF0YShjb2wpKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmVmcmVzaGVzIHRoZSBmaWx0ZXJzIGJhc2VkIG9uIHRoZSBjdXJyZW50bHkgZGlzcGxheWVkIGRhdGEgZm9yIGVhY2ggY29sdW1uXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtGaWx0ZXJzfSBUaGUgRmlsdGVycyBvYmplY3RcbiAgICAgKi9cbiAgICByZWZyZXNoRmlsdGVyczogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLmZpbHRlcnMuZm9yRWFjaChmdW5jdGlvbiAoZmlsdGVyKSB7XG4gICAgICAgICAgICBmaWx0ZXIucmVmcmVzaCh0aGlzLmdldENvbHVtbkRhdGEoZmlsdGVyLmNvbHVtbikpO1xuICAgICAgICAgICAgdGhpcy5hcHBseUZpbHRlcihmaWx0ZXIpO1xuICAgICAgICB9LCB0aGlzKTtcblxuICAgICAgICB0aGlzLmRyYXdUYWJsZSgpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbn07XG5cbiQoZG9jdW1lbnQpLm9uKCdwcmVJbml0LmR0JywgZnVuY3Rpb24gKGUsIHNldHRpbmdzKSB7XG4gICAgbmV3IEZpbHRlcnMoc2V0dGluZ3MpO1xufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gRmlsdGVycztcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snJCddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnJCddIDogbnVsbCk7XG52YXIgQmFzZUZpbHRlciA9IHJlcXVpcmUoJy4uL2Jhc2VmaWx0ZXInKTtcbnZhciBTaW1wbGVSZW5kZXJlciA9IHJlcXVpcmUoJy4uL3JlbmRlcmVyL3NpbXBsZScpO1xudmFyIEZpbHRlcnMgPSByZXF1aXJlKCcuLi9maWx0ZXJzJyk7XG5cbnZhciBJbnB1dEZpbHRlciA9ICQuZXh0ZW5kKHt9LCBCYXNlRmlsdGVyLCBTaW1wbGVSZW5kZXJlciwge1xuXG4gICAgaW5pdDogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLiRkb20gPSAkKCc8aW5wdXQgY2xhc3M9XCJmaWx0cmVcIi8+Jyk7XG4gICAgICAgIHRoaXMuJGRvbS52YWwodGhpcy5nZXRJbml0aWFsUXVlcnkoKSk7XG4gICAgICAgIHRoaXMuJGRvbS5vbignaW5wdXQnLCB0aGlzLm5vdGlmeUNoYW5nZS5iaW5kKHRoaXMpKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgcG9wdWxhdGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIHVwZGF0ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgbm9TZWxlY3Rpb25RdWVyeTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gJyc7XG4gICAgfSxcblxuICAgIGlzUmVnZXhNYXRjaDogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9LFxuXG4gICAgaGFzVmFsdWU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuJGRvbS52YWwoKSAhPSAnJztcbiAgICB9LFxuXG4gICAgc2VsZWN0ZWRRdWVyeTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy4kZG9tLnZhbCgpO1xuICAgIH0sXG5cbiAgICBnZXRJbml0aWFsUXVlcnk6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuICcnO1xuICAgIH1cbn0pO1xuXG5GaWx0ZXJzLnByb3RvdHlwZS5idWlsZGVycy5pbnB1dCA9IGZ1bmN0aW9uIChzZXR0aW5ncykge1xuICAgIHJldHVybiAkLmV4dGVuZCh7fSwgSW5wdXRGaWx0ZXIsIHNldHRpbmdzKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gSW5wdXRGaWx0ZXI7XG4iLCIndXNlIHN0cmljdCc7XG5cbnJlcXVpcmUoJy4vdXBkYXRlci91cGRhdGVOb25lJyk7XG5yZXF1aXJlKCcuL3VwZGF0ZXIvdXBkYXRlT3RoZXJzJyk7XG5yZXF1aXJlKCcuL3NlbGVjdC9zaW1wbGVzZWxlY3QnKTtcbnJlcXVpcmUoJy4vc2VsZWN0L211bHRpc2VsZWN0Jyk7XG5yZXF1aXJlKCcuL3NlbGVjdC9maXhlZHNlbGVjdCcpO1xucmVxdWlyZSgnLi9pbnB1dC9pbnB1dCcpO1xucmVxdWlyZSgnLi9maWx0ZXJzJyk7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBTaW1wbGVSZW5kZXJlciA9IHtcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgkY29udGFpbmVyLCBoZWFkZXIsIGRhdGEpIHtcbiAgICAgICAgdGhpcy5wb3B1bGF0ZShkYXRhKTtcbiAgICAgICAgdGhpcy5zaG93RmlsdGVyKHRoaXMuJGRvbSwgJGNvbnRhaW5lciwgaGVhZGVyLCBkYXRhKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgc2hvd0ZpbHRlcjogZnVuY3Rpb24oJGRvbSwgJGNvbnRhaW5lciwgaGVhZGVyKSB7XG4gICAgICAgICRjb250YWluZXIuYXBwZW5kKHRoaXMuJGRvbSk7XG4gICAgICAgIHRoaXMuJGRvbS5hdHRyKCduYW1lJywgaGVhZGVyKS5hdHRyKCdwbGFjZWhvbGRlcicsIGhlYWRlcikuc2hvdygpO1xuICAgIH0sXG5cbiAgICByZWZyZXNoOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICB0aGlzLnVwZGF0ZShkYXRhKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFNpbXBsZVJlbmRlcmVyOyIsIid1c2Ugc3RyaWN0JztcblxudmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snJCddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnJCddIDogbnVsbCk7XG52YXIgQmFzZUZpbHRlciA9IHJlcXVpcmUoJy4uL2Jhc2VmaWx0ZXInKTtcbnZhciBTaW1wbGVSZW5kZXJlciA9IHJlcXVpcmUoJy4uL3JlbmRlcmVyL3NpbXBsZScpO1xudmFyIEJvb3RzdHJhcFJlbmRlcmVyID0gcmVxdWlyZSgnLi9yZW5kZXJlci9ib290c3RyYXAnKTtcbnZhciBDaG9zZW5SZW5kZXIgPSByZXF1aXJlKCcuL3JlbmRlcmVyL2Nob3NlbicpO1xuXG4vKipcbiAqIFNlbGVjdEZpbHRlciByZWdyb3VwcyBjb21tb24gYmVoYXZpb3IgZm9yIHNlbGVjdCBmaWx0ZXJzXG4gKi9cbnZhciBTZWxlY3RGaWx0ZXIgPSAkLmV4dGVuZCh7fSwgQmFzZUZpbHRlciwge1xuICAgIHNlbGVjdGVkOiBbXSxcblxuICAgIC8qKlxuICAgICAqIEByZXR1cm5zIHtzdHJpbmd9IFJldHVybnMgYW4gYWx3YXlzIGZhbHNlIHJlZ2V4IHRvIGhpZGUgZXZlcnkgcmVjb3Jkc1xuICAgICAqIHdoZW4gbm8gb3B0aW9uIGlzIHNlbGVjdGVkXG4gICAgICovXG4gICAgbm9TZWxlY3Rpb25RdWVyeTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gJyQuXic7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlLiBTZWxlY3QgZmlsdGVycyBhbHdheXMgdXNlIHJlZ2V4XG4gICAgICovXG4gICAgaXNSZWdleE1hdGNoOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAcmV0dXJucyB7Ym9vbGVhbn0gUmV0dXJucyB0cnVlIGlmIGF0IGxlYXN0IG9uZSBvcHRpb24gaXMgc2VsZWN0ZWRcbiAgICAgKi9cbiAgICBoYXNWYWx1ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZ2V0U2VsZWN0aW9uKCkubGVuZ3RoID4gMDtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQHJldHVybnMge1N0cmluZ30gVGhlIGNvbHVtbiBmaWx0ZXIgcXVlcnkgdG8gYXBwbHkuIFNlbGVjdGVkIG9wdGlvbiB2YWx1ZXNcbiAgICAgKiBhcmUgY29uY2F0ZW5hdGVkIGludG8gYSBzdHJpbmcgdXNpbmcgdGhlIHBpcGUgY2hhcmFjdGVyIChyZWdleCBvcilcbiAgICAgKi9cbiAgICBzZWxlY3RlZFF1ZXJ5OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9nZXRTZWxlY3Rpb24oKS5tYXAoZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICBpZiAodmFsdWUgPT0gdGhpcy5hbGxUZXh0IHx8IHRoaXMuX2dldE5vdFNlbGVjdGVkKCkubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICcnO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJ14nICsgJC5mbi5kYXRhVGFibGUudXRpbC5lc2NhcGVSZWdleCh2YWx1ZSkgKyAnJCc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIHRoaXMpLmpvaW4oJ3wnKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogRmlsdGVycyB0aGUgb3B0aW9ucyBiZWZvcmUgYWRkaW5nIHRoZW0gdG8gdGhlIHNlbGVjdC4gQ2FuIGJlIG92ZXJyaWRkZW5cbiAgICAgKiBmb3Igc3BlY2lmaWMgZmlsdGVyaW5nLlxuICAgICAqIEJ5IGRlZmF1bHQsIHVzZSB0aGUgdmFsdWUgYXMgb3B0aW9uIGlmIGB2YWx1ZWAgaWYgYSBub24gZW1wdHkgc3RyaW5nLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHZhbHVlIFRoZSBvcHRpb24gdmFsdWVcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtCb29sZWFufSBUcnVlIGlmIHRoZSB2YWx1ZSBjYW4gYmUgaW5jbHVkZWQgaW4gdGhlIGZpbHRlciBvcHRpb25zLiBGYWxzZSBvdGhlcndpc2UuXG4gICAgICovXG4gICAgZmlsdGVyT3B0aW9uczogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZSAmJiB2YWx1ZS50cmltKCkgIT0gJyc7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFNvcnQgdGhlIG9wdGlvbnMgYmVmb3JlIGFkZGluZyB0aGVtIHRvIHRoZSBzZWxlY3QuIENhbiBiZSBvdmVycmlkZGVuIGZvclxuICAgICAqIHNwZWNpZmljIHNvcnRzXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gYSBUaGUgZmlyc3QgdmFsdWUgdG8gY29tcGFyZVxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBiIFRoZSBzZWNvbmQgdmFsdWUgdG8gY29tcGFyZVxuICAgICAqXG4gICAgICogQHJldHVybiB7SW50ZWdlcn0gMCBpZiB0aGUgdHdvIHZhbHVlcyBhcmUgZXF1YWwsIDEgaWYgYSA+IGIgYW5kIC0xIGlmIGEgPCBiXG4gICAgICovXG4gICAgc29ydE9wdGlvbnM6IGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgIGlmIChhID4gYikge1xuICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYSA8IGIpIHtcbiAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiAwO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAcmV0dXJucyB7QXJyYXk8U3RyaW5nPn0gVGhlIGFycmF5IG9mIHNlbGVjdGVkIHZhbHVlc1xuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2dldFNlbGVjdGlvbjogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy4kZG9tLmZpbmQoJ29wdGlvbjpzZWxlY3RlZCcpLnRvQXJyYXkoKS5tYXAoZnVuY3Rpb24gKG9wdGlvbikge1xuICAgICAgICAgICAgcmV0dXJuIG9wdGlvbi52YWx1ZTtcbiAgICAgICAgfSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHJldHVybnMgeyp8QXJyYXl9IFRoZSBhcnJheSBvZiBub24gc2VsZWN0ZWQgdmFsdWVzXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfZ2V0Tm90U2VsZWN0ZWQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuJGRvbS5maW5kKCc6bm90KG9wdGlvbjpzZWxlY3RlZCknKS50b0FycmF5KCkubWFwKGZ1bmN0aW9uIChvcHRpb24pIHtcbiAgICAgICAgICAgIHJldHVybiBvcHRpb24udmFsdWU7XG4gICAgICAgIH0pO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBGb3IgZWFjaCBlbGVtZW50IGluIHRoZSBkYXRhIG9iamVjdCwgY3JlYXRlcyBhbiBvcHRpb24gZWxlbWVudCB1c2luZyB0aGUgZnVuY3Rpb25cbiAgICAgKiBmbkNyZWF0ZVxuICAgICAqXG4gICAgICogQHBhcmFtIHtqUXVlcnl9IGRhdGEgVGhlIGRhdGEgdG8gYWRkIHRvIHRoZSBzZWxlY3RcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmbkNyZWF0ZSBUaGUgZnVuY3Rpb24gdG8gdXNlIHRvIGNyZWF0ZSB0aGUgb3B0aW9uc1xuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2FkZE9wdGlvbnM6IGZ1bmN0aW9uIChkYXRhLCBmbkNyZWF0ZSkge1xuICAgICAgICB0aGlzLiRkb20uZW1wdHkoKTtcblxuICAgICAgICBpZiAodGhpcy5hbGxUZXh0KVxuICAgICAgICAgICAgZm5DcmVhdGUuY2FsbCh0aGlzLCB0aGlzLmFsbFRleHQpO1xuXG4gICAgICAgIGRhdGEudG9BcnJheSgpLmZpbHRlcih0aGlzLmZpbHRlck9wdGlvbnMpLnNvcnQodGhpcy5zb3J0T3B0aW9ucykuZm9yRWFjaChmbkNyZWF0ZSwgdGhpcyk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBzZWxlY3RlZCBvcHRpb25cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSB2YWx1ZSBUaGUgb3B0aW9uIHZhbHVlXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfYWRkU2VsZWN0ZWRPcHRpb246IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICB0aGlzLiRkb20uYXBwZW5kKCQoJzxvcHRpb24vPicpXG4gICAgICAgICAgICAgICAgLnZhbCh2YWx1ZSlcbiAgICAgICAgICAgICAgICAudGV4dCh2YWx1ZSlcbiAgICAgICAgICAgICAgICAuYXR0cignc2VsZWN0ZWQnLCAnc2VsZWN0ZWQnKVxuICAgICAgICApO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGFuIG9wdGlvbiB3aXRoIHRoZSBzZWxlY3RlZCBmbGFnIGJhc2VkIG9uIHRoZVxuICAgICAqIGN1cnJlbnQgZmlsdGVyIHN0YXRlXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gdmFsdWUgVGhlIG9wdGlvbiB2YWx1ZVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3JlZnJlc2hPcHRpb246IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICB2YXIgJG9wdGlvbiA9ICQoJzxvcHRpb24vPicpXG4gICAgICAgICAgICAudmFsKHZhbHVlKVxuICAgICAgICAgICAgLnRleHQodmFsdWUpO1xuXG4gICAgICAgIGlmICgkLmluQXJyYXkodmFsdWUsIHRoaXMuc2VsZWN0ZWQpID4gLTEpXG4gICAgICAgICAgICAkb3B0aW9uLmF0dHIoJ3NlbGVjdGVkJywgJ3NlbGVjdGVkJyk7XG5cbiAgICAgICAgdGhpcy4kZG9tLmFwcGVuZCgkb3B0aW9uKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogVGFrZXMgYSBzbmFwc2hvdCBvZiB0aGUgY3VycmVudCBzZWxlY3Rpb24gc3RhdGVcbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3NhdmVTZWxlY3Rpb246IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5zZWxlY3RlZCA9IHRoaXMuX2dldFNlbGVjdGlvbigpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBXaGVuZXZlciB0aGUgc2VsZWN0IHN0YXRlIGNoYW5nZXMsIHNhdmUgaXRzIG5ldyBzdGF0ZSBhbmRcbiAgICAgKiBub3RpZnkgdGhlIGxpc3RlbmluZyBjb21wb25lbnRcbiAgICAgKlxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX29uQ2hhbmdlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuX3NhdmVTZWxlY3Rpb24oKTtcbiAgICAgICAgdGhpcy5ub3RpZnlDaGFuZ2UoKTtcbiAgICB9XG59KTtcblxudmFyIGF2YWlsYWJsZVJlbmRlcmVycyA9IHtcbiAgICAnYm9vdHN0cmFwJzogQm9vdHN0cmFwUmVuZGVyZXIsXG4gICAgJ2Nob3Nlbic6IENob3NlblJlbmRlclxufTtcblxudmFyIGJ1aWxkZXIgPSBmdW5jdGlvbiAoc2V0dGluZ3MpIHtcbiAgICB2YXIgcmVuZGVyZXIgPSBhdmFpbGFibGVSZW5kZXJlcnNbc2V0dGluZ3MucmVuZGVyZXJdIHx8IFNpbXBsZVJlbmRlcmVyO1xuXG4gICAgcmV0dXJuICQuZXh0ZW5kKHt9LCB0aGlzLCByZW5kZXJlciwgc2V0dGluZ3MpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgU2VsZWN0RmlsdGVyOiBTZWxlY3RGaWx0ZXIsXG4gICAgYnVpbGRlcjogYnVpbGRlclxufTsiLCIndXNlIHN0cmljdCc7XG5cbnZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJyQnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJyQnXSA6IG51bGwpO1xudmFyIEZpbHRlcnMgPSByZXF1aXJlKCcuLi9maWx0ZXJzJyk7XG52YXIgQmFzZVNlbGVjdCA9IHJlcXVpcmUoJy4vYmFzZXNlbGVjdCcpO1xuXG52YXIgRml4ZWRTZWxlY3RGaWx0ZXIgPSAkLmV4dGVuZCh7fSwgQmFzZVNlbGVjdC5TZWxlY3RGaWx0ZXIsIHtcblxuICAgIC8qKlxuICAgICAqIFNpbXBseSBzYXZlcyBhIGhhbmRsZSBvbiB0aGUgcHJvdmlkZWQgc291cmNlIHNlbGVjdFxuICAgICAqXG4gICAgICogQHJldHVybnMge0ZpeGVkU2VsZWN0RmlsdGVyfSBUaGUgc2VsZWN0IGZpbHRlclxuICAgICAqL1xuICAgIGluaXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy4kZG9tID0gJCh0aGlzLnNyYyk7XG4gICAgICAgIHRoaXMuJGRvbS5vbignY2hhbmdlJywgdGhpcy5ub3RpZnlDaGFuZ2UuYmluZCh0aGlzKSk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIE5vIGFjdGlvbiBmb3IgZml4ZWQgZmlsdGVyczogdGhlIHByb3ZpZGVkIHNlbGVjdCBpcyB1c2VkIGFzIGlzXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Rml4ZWRTZWxlY3RGaWx0ZXJ9IFRoZSBGaWx0ZXIgb2JqZWN0XG4gICAgICovXG4gICAgcG9wdWxhdGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIE5vIHVwZGF0ZSBmb3IgZml4ZWQgZmlsdGVyczogdGhlIHByb3ZpZGVkIHNlbGVjdCBpcyBuZXZlciBjaGFuZ2VkXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7Rml4ZWRTZWxlY3RGaWx0ZXJ9IFRoZSBGaWx0ZXIgb2JqZWN0XG4gICAgICovXG4gICAgdXBkYXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBGaXhlZCBmaWx0ZXJzIGNhbiBiZSB1c2VkIHRvIHByb3ZpZGUgaW5pdGlhbCBmaWx0ZXJzIHRvIGFwcGx5IHRvIHRoZVxuICAgICAqIGRhdGF0YWJsZS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBGaWx0ZXIgcXVlcnlcbiAgICAgKi9cbiAgICBnZXRJbml0aWFsUXVlcnk6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRRdWVyeSgpO1xuICAgIH1cbn0pO1xuXG5GaWx0ZXJzLnByb3RvdHlwZS5idWlsZGVycy5maXhlZHNlbGVjdCA9IEJhc2VTZWxlY3QuYnVpbGRlci5iaW5kKEZpeGVkU2VsZWN0RmlsdGVyKTtcblxubW9kdWxlLmV4cG9ydHMgPSBGaXhlZFNlbGVjdEZpbHRlcjsiLCIndXNlIHN0cmljdCc7XG5cbnZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJyQnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJyQnXSA6IG51bGwpO1xudmFyIEZpbHRlcnMgPSByZXF1aXJlKCcuLi9maWx0ZXJzJyk7XG52YXIgQmFzZVNlbGVjdCA9IHJlcXVpcmUoJy4vYmFzZXNlbGVjdCcpO1xuXG52YXIgTXVsdGlTZWxlY3RGaWx0ZXIgPSAkLmV4dGVuZCh7fSwgQmFzZVNlbGVjdC5TZWxlY3RGaWx0ZXIsIHtcblxuICAgIC8qKlxuICAgICAqIEluaXRpYWxpemVzIGEgbXVsdGlzZWxlY3QgZG9tIG9iamVjdFxuICAgICAqXG4gICAgICogQHJldHVybnMge011bHRpU2VsZWN0RmlsdGVyfSBUaGUgRmlsdGVyIG9iamVjdFxuICAgICAqL1xuICAgIGluaXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy4kZG9tID0gJCgnPHNlbGVjdCBjbGFzcz1cImZpbHRyZVwiLz4nKS5hdHRyKCdtdWx0aXBsZScsICdtdWx0aXBsZScpO1xuICAgICAgICB0aGlzLiRkb20ub24oJ2NoYW5nZScsIHRoaXMuX29uQ2hhbmdlLmJpbmQodGhpcykpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBQb3B1bGF0ZXMgdGhlIG11bHRpc2VsZWN0IHdpdGggJ3NlbGVjdGVkJyBvcHRpb25zIGJ5IGRlZmF1bHRcbiAgICAgKiBVc2VzIGdldEluaXRpYWxRdWVyeSBhcyBkZWZhdWx0IHZhbHVlKHMpXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FycmF5PFN0cmluZz59IGRhdGEgVGhlIGNvbHVtbiBkYXRhXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7TXVsdGlTZWxlY3RGaWx0ZXJ9IFRoZSBGaWx0ZXIgb2JqZWN0XG4gICAgICovXG4gICAgcG9wdWxhdGU6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgIHRoaXMuX2FkZE9wdGlvbnMoZGF0YSwgdGhpcy5fYWRkU2VsZWN0ZWRPcHRpb24pO1xuXG4gICAgICAgIC8vIFNlbGVjdCBlYWNoIHZhbHVlcyByZXR1cm5lZCBieSBnZXRJbml0aWFsUXVlcnlcbiAgICAgICAgdmFyIGluaXRpYWxRdWVyeSA9IHRoaXMuZ2V0SW5pdGlhbFF1ZXJ5KCk7XG5cbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkoaW5pdGlhbFF1ZXJ5KSkge1xuICAgICAgICAgICAgaW5pdGlhbFF1ZXJ5LmZvckVhY2goZnVuY3Rpb24gKGluaXRpYWxRdWVyeSkge1xuICAgICAgICAgICAgICAgIHRoaXMuJGRvbS5maW5kKCdvcHRpb25bdmFsdWU9XCInICsgaW5pdGlhbFF1ZXJ5ICsgJ1wiXScpLmF0dHIoJ3NlbGVjdGVkJywgJ3NlbGVjdGVkJyk7XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9IGVsc2UgeyAvLyBBc3N1bWUgaW5pdGlhbCBxdWVyeSBpcyBhIHN0cmluZ1xuICAgICAgICAgICAgdGhpcy4kZG9tLmZpbmQoJ29wdGlvblt2YWx1ZT1cIicgKyBpbml0aWFsUXVlcnkgKyAnXCJdJykuYXR0cignc2VsZWN0ZWQnLCAnc2VsZWN0ZWQnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX3NhdmVTZWxlY3Rpb24oKTtcbiAgICAgICAgdGhpcy5fb25DaGFuZ2UoKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogSWYgdGhlICdhbGwnIG9wdGlvbiBpcyBzZWxlY3RlZCwgc2V0cyB0aGUgbmV3IG9wdGlvbnMgYXMgJ3NlbGVjdGVkJy5cbiAgICAgKiBPdGhlcndpc2UsIGFkZHMgdGhlIG9wdGlvbnMgYmFzZWQgb24gdGhlIGZpbHRlciBzdGF0ZVxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcnJheTxTdHJpbmc+fSBkYXRhIFRoZSBjb2x1bW4gZGF0YVxuICAgICAqXG4gICAgICogQHJldHVybnMge011bHRpU2VsZWN0RmlsdGVyfSBUaGUgRmlsdGVyIG9iamVjdFxuICAgICAqL1xuICAgIHVwZGF0ZTogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgaWYgKCQuaW5BcnJheSh0aGlzLmFsbFRleHQsIHRoaXMuc2VsZWN0ZWQpID4gLTEgfHwgdGhpcy5fZ2V0Tm90U2VsZWN0ZWQoKS5sZW5ndGggPT0gMClcbiAgICAgICAgICAgIHRoaXMuX2FkZE9wdGlvbnMoZGF0YSwgdGhpcy5fYWRkU2VsZWN0ZWRPcHRpb24pO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgICB0aGlzLl9hZGRPcHRpb25zKGRhdGEsIHRoaXMuX3JlZnJlc2hPcHRpb24pO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBUaGlzIGZpbHRlciBpcyBkeW5hbWljLCBpdCBjYW4ndCBiZSB1c2VkIGZvciBpbml0aWFsIGZpbHRlcmluZ1xuICAgICAqXG4gICAgICogQHJldHVybnMge1N0cmluZ30gVGhlIGZpbHRlciBpbml0aWFsIHF1ZXJ5XG4gICAgICovXG4gICAgZ2V0SW5pdGlhbFF1ZXJ5OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiAnJztcbiAgICB9XG59KTtcblxuRmlsdGVycy5wcm90b3R5cGUuYnVpbGRlcnMubXVsdGlzZWxlY3QgPSBCYXNlU2VsZWN0LmJ1aWxkZXIuYmluZChNdWx0aVNlbGVjdEZpbHRlcik7XG5cbm1vZHVsZS5leHBvcnRzID0gTXVsdGlTZWxlY3RGaWx0ZXI7XG4iLCIndXNlIHN0cmljdCc7XG52YXIgJCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WyckJ10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWyckJ10gOiBudWxsKTtcblxudmFyIEJvb3RzdHJhcFJlbmRlcmVyID0ge1xuICAgIHJlbmRlcjogZnVuY3Rpb24gKCRjb250YWluZXIsIGhlYWRlciwgZGF0YSkge1xuICAgICAgICB0aGlzLnBvcHVsYXRlKGRhdGEpO1xuICAgICAgICB0aGlzLnNob3dGaWx0ZXIodGhpcy4kZG9tLCAkY29udGFpbmVyLCBoZWFkZXIsIGRhdGEpO1xuXG4gICAgICAgIHZhciBkZWZhdWx0T3B0aW9ucyA9IHtcbiAgICAgICAgICAgIGJ1dHRvblRleHQ6IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgdmFyIG5iU2VsZWN0ZWQgPSAkKG9wdGlvbnMpLmZpbHRlcignOnNlbGVjdGVkJykubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGlmIChuYlNlbGVjdGVkID09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGhlYWRlcjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIGhlYWRlciArICcgKCcgKyBuYlNlbGVjdGVkICsgJyknO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuJGRvbS5tdWx0aXNlbGVjdCgkLmV4dGVuZChkZWZhdWx0T3B0aW9ucywgdGhpcy5yZW5kZXJlck9wdGlvbnMpKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgc2hvd0ZpbHRlcjogZnVuY3Rpb24gKCRkb20sICRjb250YWluZXIpIHtcbiAgICAgICAgJGNvbnRhaW5lci5hcHBlbmQodGhpcy4kZG9tKTtcbiAgICB9LFxuXG4gICAgcmVmcmVzaDogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgdGhpcy51cGRhdGUoZGF0YSk7XG4gICAgICAgIHRoaXMuJGRvbS5tdWx0aXNlbGVjdCgncmVidWlsZCcpO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQm9vdHN0cmFwUmVuZGVyZXI7IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgQ2hvc2VuUmVuZGVyZXIgPSB7XG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoJGNvbnRhaW5lciwgaGVhZGVyLCBkYXRhKSB7XG4gICAgICAgIHRoaXMucG9wdWxhdGUoZGF0YSk7XG4gICAgICAgIHRoaXMuc2hvd0ZpbHRlcih0aGlzLiRkb20sICRjb250YWluZXIsIGhlYWRlciwgZGF0YSk7XG4gICAgICAgIHRoaXMuJGRvbS5jaG9zZW4odGhpcy5yZW5kZXJlck9wdGlvbnMgfHwge30pO1xuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICBzaG93RmlsdGVyOiBmdW5jdGlvbigkZG9tLCAkY29udGFpbmVyKSB7XG4gICAgICAgICRjb250YWluZXIuYXBwZW5kKHRoaXMuJGRvbSk7XG4gICAgfSxcblxuICAgIHJlZnJlc2g6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgIHRoaXMudXBkYXRlKGRhdGEpO1xuICAgICAgICB0aGlzLiRkb20udHJpZ2dlcignY2hvc2VuOnVwZGF0ZWQnKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IENob3NlblJlbmRlcmVyOyIsIid1c2Ugc3RyaWN0JztcblxudmFyICQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snJCddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnJCddIDogbnVsbCk7XG52YXIgRmlsdGVycyA9IHJlcXVpcmUoJy4uL2ZpbHRlcnMnKTtcbnZhciBCYXNlU2VsZWN0ID0gcmVxdWlyZSgnLi9iYXNlc2VsZWN0Jyk7XG5cbnZhciBTaW1wbGVTZWxlY3RGaWx0ZXIgPSAkLmV4dGVuZCh7fSwgQmFzZVNlbGVjdC5TZWxlY3RGaWx0ZXIsIHtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBzaW1wbGUgc2VsZWN0XG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7U2ltcGxlU2VsZWN0RmlsdGVyfSBUaGUgRmlsdGVyIG9iamVjdFxuICAgICAqL1xuICAgIGluaXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy4kZG9tID0gJCgnPHNlbGVjdCBjbGFzcz1cImZpbHRyZVwiLz4nKTtcbiAgICAgICAgdGhpcy4kZG9tLm9uKCdjaGFuZ2UnLCB0aGlzLl9vbkNoYW5nZS5iaW5kKHRoaXMpKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQWRkcyBhbGwgb3B0aW9ucyB3aXRob3V0IHNwZWNpZnlpbmcgdGhlICdzZWxlY3RlZCcgZmxhZ1xuICAgICAqIElmIGFuIG9wdGlvbiB3aXRoIGBnZXRJbml0aWFsUXVlcnlgIHZhbHVlIGV4aXN0cywgc2VsZWN0cyBpdCxcbiAgICAgKiBvdGhlcndpc2UsIHRoZSBmaXJzdCBvcHRpb24gaXMgc2VsZWN0ZWQgYnkgZGVmYXVsdFxuICAgICAqXG4gICAgICogQHBhcmFtIHtBcnJheTxTdHJpbmc+fSBkYXRhIFRoZSBjb2x1bW4gZGF0YVxuICAgICAqXG4gICAgICogQHJldHVybnMge1NpbXBsZVNlbGVjdEZpbHRlcn0gVGhlIGZpbHRlciBvYmplY3RcbiAgICAgKi9cbiAgICBwb3B1bGF0ZTogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgdGhpcy5fYWRkT3B0aW9ucyhkYXRhLCB0aGlzLl9yZWZyZXNoT3B0aW9uKTtcbiAgICAgICAgdGhpcy4kZG9tLmZpbmQoJ29wdGlvblt2YWx1ZT1cIicgKyB0aGlzLmdldEluaXRpYWxRdWVyeSgpICsgJ1wiXScpLmF0dHIoJ3NlbGVjdGVkJywgJ3NlbGVjdGVkJyk7XG4gICAgICAgIHRoaXMuX3NhdmVTZWxlY3Rpb24oKTtcbiAgICAgICAgdGhpcy5fb25DaGFuZ2UoKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmVmcmVzaCB0aGUgb3B0aW9ucyBiYXNlZCBvbiB0aGUgZmlsdGVyIHN0YXRlXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FycmF5PFN0cmluZz59IGRhdGEgVGhlIGNvbHVtbiBkYXRhXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB7U2ltcGxlU2VsZWN0RmlsdGVyfSBUaGUgZmlsdGVyIG9iamVjdFxuICAgICAqL1xuICAgIHVwZGF0ZTogZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgdGhpcy5fYWRkT3B0aW9ucyhkYXRhLCB0aGlzLl9yZWZyZXNoT3B0aW9uKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogVGhpcyBmaWx0ZXIgaXMgZHluYW1pYywgaXQgY2FuJ3QgYmUgdXNlZCBmb3IgaW5pdGlhbCBmaWx0ZXJpbmdcbiAgICAgKlxuICAgICAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBmaWx0ZXIncyBpbml0aWFsIHF1ZXJ5XG4gICAgICovXG4gICAgZ2V0SW5pdGlhbFF1ZXJ5OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuICcnO1xuICAgIH1cbn0pO1xuXG5GaWx0ZXJzLnByb3RvdHlwZS5idWlsZGVycy5zZWxlY3QgPSBCYXNlU2VsZWN0LmJ1aWxkZXIuYmluZChTaW1wbGVTZWxlY3RGaWx0ZXIpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFNpbXBsZVNlbGVjdEZpbHRlcjtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIEZpbHRlcnMgPSByZXF1aXJlKCcuLi9maWx0ZXJzJyk7XG5cbi8qKlxuICogRHVtbXkgdXBkYXRlclxuICovXG52YXIgVXBkYXRlTm9uZSA9IHtcbiAgICByZWZyZXNoQWxsRmlsdGVyczogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG59O1xuXG5GaWx0ZXJzLnByb3RvdHlwZS51cGRhdGVycy5ub25lID0gVXBkYXRlTm9uZTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIEZpbHRlcnMgPSByZXF1aXJlKCcuLi9maWx0ZXJzJyk7XG5cbi8qKlxuICogRWFjaCB0aW1lIGEgZmlsdGVyIGNoYW5nZWQsXG4gKiByZWZyZXNoIHRoZSBvdGhlcnMgZmlsdGVycy5cbiAqL1xudmFyIFVwZGF0ZU90aGVycyA9IHtcblxuICAgIHJlZnJlc2hBbGxGaWx0ZXJzOiBmdW5jdGlvbiAoZmlsdGVyKSB7XG4gICAgICAgIC8vIHJlZnJlc2ggYWxsIGZpbHRlcnNcbiAgICAgICAgLy8gZXhjZXB0IHRoZSBjaGFuZ2VkIG9uZSxcbiAgICAgICAgLy8gdW5sZXNzIHRoZSBmaWx0ZXIgaXMgcmVzZXR0ZWQuXG4gICAgICAgIHZhciBmaWx0ZXJzVG9SZWZyZXNoID0gdGhpcy5maWx0ZXJzXG4gICAgICAgICAgICAuZmlsdGVyKGZ1bmN0aW9uIChmKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGYuY29sdW1uICE9PSBmaWx0ZXIuY29sdW1uO1xuICAgICAgICAgICAgfSk7XG5cblxuICAgICAgICBmaWx0ZXJzVG9SZWZyZXNoLmZvckVhY2goZnVuY3Rpb24gKGZpbHRlcikge1xuICAgICAgICAgICAgZmlsdGVyLnJlZnJlc2godGhpcy5nZXRGaWx0ZXJlZENvbHVtbkRhdGEoZmlsdGVyLmNvbHVtbikpO1xuICAgICAgICB9LCB0aGlzKTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG59O1xuXG5GaWx0ZXJzLnByb3RvdHlwZS51cGRhdGVycy5vdGhlcnMgPSBVcGRhdGVPdGhlcnM7XG4iXX0=
