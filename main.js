/*eslint-env node, es6*/

/* Module Description */

/* Put dependencies here */

/* Include this line only if you are going to use Canvas API */
// const canvas = require('canvas-wrapper');


module.exports = (course, stepCallback) => {
    try {

        // Remeber to include AT LEAST ONE course.log in your child module
        course.log('Table description', {column: 'value'});
    
        /* You should never call the stepCallback with an error. We want the
        whole program to run when testing so we can catch all existing errors */
        stepCallback(null, course);

    } catch(err) {
        // catch all uncaught errors. Don't pass errors here on purpose
        course.error(err);
        stepCallback(null, course);
        return;
    }
};
