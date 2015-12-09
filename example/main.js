var $ = require('jquery');
require('../js/filters');

$(document).ready(function () {
        $('#exampleTable').DataTable({
            columns: [
                {
                    filter: {
                        type: 'select',
                        options: {
                            allText: 'All countries'
                        }
                    }
                },
                {
                    filter: {
                        type: 'select',
                        options: {
                            multiple: true,
                            allText: 'Tous',
                            showFilter: function ($dom) {
                                $('#cityFilter').append($dom);
                            }
                        }
                    }
                },
                {
                    filter: {
                        type: 'select',
                        options: {
                            allText: 'All languages',
                            filterOptions: function (option) {
                                return option != 'N/A';
                            }
                        }
                    }
                },
                {
                    filter: {
                        type: 'input'
                    }
                }
            ]
        });
    }
);