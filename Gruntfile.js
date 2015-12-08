module.exports = function (grunt) {

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        concat: {
            dist: {
                src: [
                    'js/*.js',
                ],
                dest: 'dist/datatable-filters.js'
            }
        },
        uglify: {
            build: {
                src: 'dist/datatable-filters.js',
                dest: 'dist/datatable-filters.min.js'
            }

        }
    });

    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-uglify');

    // Default task(s).
    grunt.registerTask('default', ['concat', 'uglify']);
};