const hasUppercase = (str) => {
    const uppercasePattern = /[A-Z]/;
    return uppercasePattern.test(str);
};

const hasLowercase = (str) => {
    const lowercasePattern = /[a-z]/;
    return lowercasePattern.test(str);
};

const hasNumber = (str) => {
    const numberPattern = /\d/;
    return numberPattern.test(str);
};

const getFirstLetterOfEachWord = (str) => {
    const wordQuantity = str.split(" ").length;
    const wordsArr = str.split(" ");
    const result =
        wordQuantity <= 3
            ? wordsArr.map((word) => word[0]).reduce((acc, cur) => acc + cur)
            : wordsArr
                  .map((word, index) =>
                      index === 0 || index === wordQuantity - 2 || index === wordQuantity - 1 ? word[0] : "",
                  )
                  .reduce((acc, cur) => acc + cur);
    
    return { children: result };
};

export { hasUppercase, hasLowercase, hasNumber, getFirstLetterOfEachWord };
