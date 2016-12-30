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
