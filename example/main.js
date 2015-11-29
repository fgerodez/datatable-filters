require.config({
    baseUrl: "../js",
    paths: {
        "jquery": "https://cdnjs.cloudflare.com/ajax/libs/jquery/1.11.3/jquery.min",
        "datatables": "https://cdnjs.cloudflare.com/ajax/libs/datatables/1.10.10/js/jquery.dataTables.min"
    }
});

require( ["datatables", "filters", "inputfilter", "selectfilter"],
    function(Datatable, Filters, InputFilter, SelectFilter) {
        new Filters('#exampleTable', [
            new SelectFilter({
                column: 0,
                allText: 'All countries'
            }),
            new SelectFilter({
                column: 1,
                multiple: true,
                showFilter: function($dom) {
                    $('#cityFilter').append($dom);
                }
            }),
            new SelectFilter({
                column: 2,
                allText: 'All languages',
                filterOptions: function(option) {
                    return option != 'N/A';
                }
            }),
            new InputFilter({
                column: 3
            })
        ]);

        $('#exampleTable').DataTable();
    }
);