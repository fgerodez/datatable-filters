'use strict';

var DynamicRenderer = {

    render: function ($container, header, data) {
        this.populate(data);
        $container.append(this.$dom);

        return this;
    },

    refresh: function (data) {
        this.update(data);

        return this;
    }
};

module.exports = DynamicRenderer;